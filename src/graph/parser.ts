/**
 * parser.ts — Per-file AST walker using @typescript-eslint/typescript-estree
 *
 * Extracts from TypeScript / TSX / JavaScript / JSX files:
 *   - Function declarations + named arrow functions
 *   - Class declarations
 *   - Interface declarations
 *   - Type aliases
 *   - Import statements (for IMPORTS edges)
 *   - Call expressions (raw, for CALLS edge resolution in pass 2)
 *   - JSX component usage (for RENDERS edges)
 *   - Navigation calls: navigate/push/replace (for NAVIGATES_TO edges)
 *
 * RN label classifier (applied to function/component names):
 *   useXxx           → Hook
 *   XxxScreen        → Screen
 *   XxxNavigator     → Navigator
 *   XxxProvider      → Provider
 *   XxxSlice         → Slice
 *   <default>        → Function / Component (if JSX returned)
 *
 * Scope attribution strategy (no leave callback needed):
 *   All calls/renders/navigates are collected with line numbers.
 *   After the walk, each is matched to the smallest enclosing symbol node
 *   by line-range overlap. This avoids needing a mutable scope stack.
 */

import { parse, simpleTraverse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { GraphNode, NodeLabel, ParsedFile, RawCallRef, RawNavigateRef, RawRenderRef } from './types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVIGATION_METHODS = new Set(['navigate', 'push', 'replace', 'reset', 'goBack', 'pop', 'dispatch']);

// ─── RN label classifier ──────────────────────────────────────────────────────

function classifyLabel(name: string, returnsJSX: boolean): NodeLabel {
  if (/^use[A-Z]/.test(name))            return 'Hook';
  if (/Screen$/.test(name))              return 'Screen';
  if (/Navigator$/.test(name))           return 'Navigator';
  if (/Provider$/.test(name))            return 'Provider';
  if (/Slice$/.test(name))               return 'Slice';
  if (returnsJSX || /^[A-Z]/.test(name)) return 'Component';
  return 'Function';
}

// ─── ID helpers ───────────────────────────────────────────────────────────────

function nodeId(filePath: string, name: string, line: number): string {
  return crypto
    .createHash('md5')
    .update(`${filePath}:${name}:${line}`)
    .digest('hex')
    .slice(0, 16);
}

export function edgeId(a: string, b: string, type: string): string {
  return crypto
    .createHash('md5')
    .update(`${a}:${b}:${type}`)
    .digest('hex')
    .slice(0, 16);
}

// ─── Signature builders ───────────────────────────────────────────────────────

function funcSignature(
  name: string,
  node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  isAsync: boolean,
): string {
  const params = node.params.map(paramName).join(', ');
  return `${isAsync ? 'async ' : ''}${name}(${params})`;
}

function paramName(p: TSESTree.Parameter): string {
  switch (p.type) {
    case 'Identifier':         return p.name;
    case 'AssignmentPattern':  return paramName(p.left as TSESTree.Parameter);
    case 'RestElement':        return `...${paramName(p.argument as TSESTree.Parameter)}`;
    case 'ObjectPattern':      return '{…}';
    case 'ArrayPattern':       return '[…]';
    default:                   return '_';
  }
}

// ─── JSX detection ────────────────────────────────────────────────────────────

function bodyReturnsJSX(body: TSESTree.BlockStatement | TSESTree.Expression | null): boolean {
  if (!body) return false;
  if (body.type === 'JSXElement' || body.type === 'JSXFragment') return true;
  if (body.type !== 'BlockStatement') return false;
  for (const stmt of body.body) {
    if (
      stmt.type === 'ReturnStatement' && stmt.argument &&
      (stmt.argument.type === 'JSXElement' || stmt.argument.type === 'JSXFragment')
    ) return true;
  }
  return false;
}

// ─── Import resolver ──────────────────────────────────────────────────────────

function resolveImport(importSource: string, currentFile: string, rootDir: string): string | null {
  if (!importSource.startsWith('.')) return null; // external package
  const base = path.resolve(path.dirname(path.join(rootDir, currentFile)), importSource);
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']) {
    const rel = path.relative(rootDir, base + ext).replace(/\\/g, '/');
    if (!rel.startsWith('..')) return rel;
  }
  return path.relative(rootDir, base).replace(/\\/g, '/');
}

// ─── Navigation call extractor ────────────────────────────────────────────────

function extractNavigateTarget(callExpr: TSESTree.CallExpression): string | null {
  const callee = callExpr.callee;
  if (callee.type !== 'MemberExpression') return null;
  const methodName = callee.property.type === 'Identifier' ? callee.property.name : '';
  if (!NAVIGATION_METHODS.has(methodName)) return null;
  const firstArg = callExpr.arguments[0];
  if (!firstArg) return null;
  if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') return firstArg.value;
  if (firstArg.type === 'Identifier') return firstArg.name;
  return null;
}

// ─── Call name extractor ──────────────────────────────────────────────────────

function extractCallName(callExpr: TSESTree.CallExpression): string | null {
  const { callee } = callExpr;
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
    return callee.property.name;
  }
  return null;
}

// ─── JSX component name extractor ────────────────────────────────────────────

function jsxComponentName(node: TSESTree.JSXOpeningElement): string | null {
  const { name } = node;
  if (name.type === 'JSXIdentifier') {
    return /^[A-Z]/.test(name.name) ? name.name : null;
  }
  if (name.type === 'JSXMemberExpression' && name.property.type === 'JSXIdentifier') {
    return name.property.name;
  }
  return null;
}

// ─── Scope attribution ────────────────────────────────────────────────────────
// After collecting all nodes, find the innermost node whose range contains `line`.

interface SymRange {
  qname: string;
  start: number;
  end: number;
}

function findEnclosingScope(line: number, ranges: SymRange[], fileQname: string): string {
  let best: SymRange | null = null;
  for (const r of ranges) {
    if (line >= r.start && line <= r.end) {
      if (!best || (r.end - r.start) < (best.end - best.start)) {
        best = r;
      }
    }
  }
  return best ? best.qname : fileQname;
}

// ─── Exported node check ──────────────────────────────────────────────────────

function isExported(node: TSESTree.Node): boolean {
  const p = (node as { parent?: TSESTree.Node }).parent;
  if (!p) return false;
  return p.type === 'ExportNamedDeclaration' || p.type === 'ExportDefaultDeclaration';
}

// ─── Main per-file parser ─────────────────────────────────────────────────────

export function parseFile(absolutePath: string, rootDir: string): ParsedFile | null {
  let source: string;
  try {
    source = fs.readFileSync(absolutePath, 'utf8');
  } catch {
    return null;
  }

  const ext      = path.extname(absolutePath).toLowerCase();
  const tsx      = ext === '.tsx' || ext === '.jsx';
  const filePath = path.relative(rootDir, absolutePath).replace(/\\/g, '/');

  let ast: TSESTree.Program;
  try {
    ast = parse(source, {
      jsx: tsx,
      loc: true,
      range: false,
      comment: false,
      tokens: false,
      errorOnUnknownASTType: false,
      allowInvalidAST: true,
    });
  } catch {
    return null;
  }

  const nodes: GraphNode[]         = [];
  const importedFiles: string[]    = [];
  const symRanges: SymRange[]      = [];

  // Intermediate: raw events with line numbers — scopes resolved after walk
  const rawCallsWithLine:     Array<{ calleeName: string; line: number }>     = [];
  const rawNavigatesWithLine: Array<{ targetName: string; line: number }>     = [];
  const rawRendersWithLine:   Array<{ compName: string; line: number }>       = [];

  function addNode(
    name: string, label: NodeLabel, line: number, lineEnd: number,
    sig: string, exported: boolean, isAsync: boolean,
  ): GraphNode {
    const id    = nodeId(filePath, name, line);
    const qname = `${filePath}:${name}`;
    const n: GraphNode = {
      id, label, name, qualifiedName: qname, filePath,
      lineStart: line, lineEnd, signature: sig,
      exported, async: isAsync, language: 'typescript', properties: {},
    };
    nodes.push(n);
    symRanges.push({ qname, start: line, end: lineEnd });
    return n;
  }

  // ── Single-pass walk ────────────────────────────────────────────────────────
  simpleTraverse(ast, {
    enter(node) {
      // Import declarations
      if (node.type === 'ImportDeclaration') {
        const resolved = resolveImport(node.source.value, filePath, rootDir);
        if (resolved) importedFiles.push(resolved);
        return;
      }

      // Function declarations
      if (node.type === 'FunctionDeclaration' && node.id) {
        const name    = node.id.name;
        const isAsync = node.async;
        const jsxRet  = bodyReturnsJSX(node.body);
        const label   = classifyLabel(name, jsxRet);
        const line    = node.loc?.start.line ?? 0;
        const lineEnd = node.loc?.end.line ?? line;
        addNode(name, label, line, lineEnd, funcSignature(name, node, isAsync), isExported(node), isAsync);
        return;
      }

      // Variable declarations: const Foo = () => … / const Foo = function…
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (decl.id.type !== 'Identifier') continue;
          if (!decl.init) continue;
          const fn = decl.init;
          if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') continue;
          const name    = decl.id.name;
          const isAsync = fn.async;
          const jsxRet  = bodyReturnsJSX(fn.body);
          const label   = classifyLabel(name, jsxRet);
          const line    = fn.loc?.start.line ?? 0;
          const lineEnd = fn.loc?.end.line ?? line;
          addNode(name, label, line, lineEnd, funcSignature(name, fn, isAsync), isExported(node), isAsync);
        }
        return;
      }

      // Class declarations
      if (node.type === 'ClassDeclaration' && node.id) {
        const name      = node.id.name;
        const line      = node.loc?.start.line ?? 0;
        const lineEnd   = node.loc?.end.line ?? line;
        const superCls  = node.superClass?.type === 'Identifier' ? node.superClass.name : undefined;
        addNode(name, 'Class', line, lineEnd,
          `class ${name}${superCls ? ` extends ${superCls}` : ''}`, isExported(node), false);
        return;
      }

      // Interfaces
      if (node.type === 'TSInterfaceDeclaration') {
        const name    = node.id.name;
        const line    = node.loc?.start.line ?? 0;
        const lineEnd = node.loc?.end.line ?? line;
        addNode(name, 'Interface', line, lineEnd, `interface ${name}`, false, false);
        return;
      }

      // Type aliases
      if (node.type === 'TSTypeAliasDeclaration') {
        const name = node.id.name;
        const line = node.loc?.start.line ?? 0;
        addNode(name, 'Type', line, line, `type ${name}`, false, false);
        return;
      }

      // Call expressions — collect with line; resolve scope after walk
      if (node.type === 'CallExpression') {
        const line = node.loc?.start.line ?? 0;

        const navTarget = extractNavigateTarget(node);
        if (navTarget) {
          rawNavigatesWithLine.push({ targetName: navTarget, line });
          return;
        }

        const callee = extractCallName(node);
        if (callee && callee.length > 1) {
          rawCallsWithLine.push({ calleeName: callee, line });
        }
        return;
      }

      // JSX component usage
      if (node.type === 'JSXOpeningElement') {
        const compName = jsxComponentName(node);
        if (compName) {
          rawRendersWithLine.push({ compName, line: node.loc?.start.line ?? 0 });
        }
      }
    },
  }, /* setParentPointers */ true);

  // ── Resolve scopes by line-range matching ──────────────────────────────────
  const rawCalls: RawCallRef[] = rawCallsWithLine.map(({ calleeName, line }) => ({
    callerQualifiedName: findEnclosingScope(line, symRanges, filePath),
    calleeName,
    line,
  }));

  const rawNavigates: RawNavigateRef[] = rawNavigatesWithLine.map(({ targetName, line }) => ({
    callerQualifiedName: findEnclosingScope(line, symRanges, filePath),
    targetScreenName: targetName,
    line,
  }));

  const rawRenders: RawRenderRef[] = rawRendersWithLine.map(({ compName, line }) => ({
    callerQualifiedName: findEnclosingScope(line, symRanges, filePath),
    renderedComponentName: compName,
    line,
  }));

  return { filePath, nodes, importedFiles, rawCalls, rawNavigates, rawRenders };
}
