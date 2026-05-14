import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DSLMemory, DSLEntry, DSLCandidate, DSLLearnedEntry, DSLScope } from '../types/index.js';

const GLOBAL_DIR = path.join(os.homedir(), '.rn-token-optimizer');
const GLOBAL_DSL_PATH = path.join(GLOBAL_DIR, 'dsl.json');
const PROJECT_DSL_FILENAME = '.rn-token-optimizer/dsl.json';

export function emptyMemory(): DSLMemory {
  return {
    aliases: {},
    macros: {},
    defaults: {},
    candidates: {},
    learned: {},
  };
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJSON(filePath: string): DSLMemory | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as DSLMemory;
  } catch {
    return null;
  }
}

function writeJSON(filePath: string, data: DSLMemory): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function getProjectDSLPath(): string | null {
  let dir = process.cwd();
  const root = path.parse(dir).root;
  while (dir !== root) {
    const candidate = path.join(dir, PROJECT_DSL_FILENAME);
    if (fs.existsSync(candidate)) return candidate;
    const parentDir = path.dirname(dir);
    if (parentDir === dir) break;
    dir = parentDir;
  }
  // Default: create in cwd
  return path.join(process.cwd(), PROJECT_DSL_FILENAME);
}

export function loadGlobalMemory(): DSLMemory {
  return readJSON(GLOBAL_DSL_PATH) ?? emptyMemory();
}

export function loadProjectMemory(): DSLMemory {
  const p = getProjectDSLPath();
  if (!p) return emptyMemory();
  return readJSON(p) ?? emptyMemory();
}

export function saveGlobalMemory(mem: DSLMemory): void {
  writeJSON(GLOBAL_DSL_PATH, mem);
}

export function saveProjectMemory(mem: DSLMemory): void {
  const p = getProjectDSLPath() ?? path.join(process.cwd(), PROJECT_DSL_FILENAME);
  writeJSON(p, mem);
}

export function mergeMemories(global: DSLMemory, project: DSLMemory): DSLMemory {
  return {
    aliases: { ...global.aliases, ...project.aliases },
    macros: { ...global.macros, ...project.macros },
    defaults: { ...global.defaults, ...project.defaults },
    candidates: { ...global.candidates, ...project.candidates },
    learned: { ...global.learned, ...project.learned },
  };
}

export function loadActiveMemory(): DSLMemory {
  return mergeMemories(loadGlobalMemory(), loadProjectMemory());
}

export function addAlias(
  key: string,
  value: string,
  scope: DSLScope,
  pinned = false,
): void {
  const entry: DSLEntry = { value, scope, pinned, uses: 0 };
  if (scope === 'global') {
    const mem = loadGlobalMemory();
    mem.aliases[key] = entry;
    saveGlobalMemory(mem);
  } else {
    const mem = loadProjectMemory();
    mem.aliases[key] = entry;
    saveProjectMemory(mem);
  }
}

export function addMacro(key: string, value: string, scope: DSLScope): void {
  if (scope === 'global') {
    const mem = loadGlobalMemory();
    mem.macros[key] = value;
    saveGlobalMemory(mem);
  } else {
    const mem = loadProjectMemory();
    mem.macros[key] = value;
    saveProjectMemory(mem);
  }
}

export function pinAlias(key: string, scope: DSLScope): boolean {
  if (scope === 'global') {
    const mem = loadGlobalMemory();
    if (!mem.aliases[key]) return false;
    mem.aliases[key].pinned = true;
    saveGlobalMemory(mem);
    return true;
  } else {
    const mem = loadProjectMemory();
    if (!mem.aliases[key]) return false;
    mem.aliases[key].pinned = true;
    saveProjectMemory(mem);
    return true;
  }
}

export function addCandidate(key: string, value: string, scope: DSLScope): void {
  const now = new Date().toISOString().split('T')[0];
  const entry: DSLCandidate = { value, uses: 1, firstSeen: now, lastSeen: now };
  if (scope === 'global') {
    const mem = loadGlobalMemory();
    if (mem.candidates[key]) {
      mem.candidates[key].uses += 1;
      mem.candidates[key].lastSeen = now;
    } else {
      mem.candidates[key] = entry;
    }
    saveGlobalMemory(mem);
  } else {
    const mem = loadProjectMemory();
    if (mem.candidates[key]) {
      mem.candidates[key].uses += 1;
      mem.candidates[key].lastSeen = now;
    } else {
      mem.candidates[key] = entry;
    }
    saveProjectMemory(mem);
  }
}

export function promoteCandidate(
  key: string,
  scope: DSLScope,
  dryRun = false,
): { promoted: boolean; entry?: DSLLearnedEntry } {
  const mem = scope === 'global' ? loadGlobalMemory() : loadProjectMemory();
  const candidate = mem.candidates[key];
  if (!candidate) return { promoted: false };

  const learned: DSLLearnedEntry = {
    value: candidate.value,
    promoted: new Date().toISOString().split('T')[0],
  };

  if (!dryRun) {
    mem.learned[key] = learned;
    delete mem.candidates[key];
    if (scope === 'global') saveGlobalMemory(mem);
    else saveProjectMemory(mem);
  }

  return { promoted: true, entry: learned };
}

export function pruneStale(pruneAfterDays: number, scope: DSLScope, dryRun = false): string[] {
  const mem = scope === 'global' ? loadGlobalMemory() : loadProjectMemory();
  const cutoff = Date.now() - pruneAfterDays * 86_400_000;
  const pruned: string[] = [];

  for (const [key, entry] of Object.entries(mem.aliases)) {
    if (entry.pinned) continue;
    if (entry.lastSeen && new Date(entry.lastSeen).getTime() < cutoff) {
      pruned.push(`alias:${key}`);
      if (!dryRun) delete mem.aliases[key];
    }
  }

  for (const [key, entry] of Object.entries(mem.candidates)) {
    if (new Date(entry.lastSeen).getTime() < cutoff) {
      pruned.push(`candidate:${key}`);
      if (!dryRun) delete mem.candidates[key];
    }
  }

  for (const [key, entry] of Object.entries(mem.learned)) {
    if (entry.lastSeen && new Date(entry.lastSeen).getTime() < cutoff) {
      pruned.push(`learned:${key}`);
      if (!dryRun) delete mem.learned[key];
    }
  }

  if (!dryRun) {
    if (scope === 'global') saveGlobalMemory(mem);
    else saveProjectMemory(mem);
  }

  return pruned;
}

export function getGlobalDir(): string {
  return GLOBAL_DIR;
}
