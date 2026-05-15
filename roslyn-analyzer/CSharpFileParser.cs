using System.Security.Cryptography;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace RnTokenOptimizer.Roslyn;

/// <summary>
/// Parses a single C# source file using Roslyn's syntactic API (no compilation
/// required) and returns a <see cref="ParsedFileResult"/> whose structure
/// mirrors the TypeScript ParsedFile type consumed by the Node.js graph store.
///
/// Two-pass strategy (mirroring the TypeScript parser.ts):
///   Pass 1 — collect symbol nodes + raw references while walking the AST.
///   Pass 2 — resolve enclosing scope for each raw reference by line-range
///             matching (same algorithm as TS findEnclosingScope).
/// </summary>
public sealed class CSharpFileParser
{
    private readonly string _rootDir;

    public CSharpFileParser(string rootDir)
    {
        _rootDir = rootDir.TrimEnd(Path.DirectorySeparatorChar, '/');
    }

    // ─── Public entry ──────────────────────────────────────────────────────────

    public ParsedFileResult Parse(string absolutePath)
    {
        var source = File.ReadAllText(absolutePath, Encoding.UTF8);
        var relPath = Path.GetRelativePath(_rootDir, absolutePath)
                         .Replace('\\', '/');

        var tree = CSharpSyntaxTree.ParseText(source,
            CSharpParseOptions.Default.WithLanguageVersion(LanguageVersion.Latest));
        var root = (CompilationUnitSyntax)tree.GetRoot();

        var walker = new GraphWalker(relPath);
        walker.Visit(root);

        return new ParsedFileResult(
            FilePath: relPath,
            Nodes: walker.Nodes,
            ImportedFiles: [],           // C# using-directives are namespace-level, not file-level
            RawCalls: walker.RawCalls,
            RawNavigates: [],
            RawRenders: []
        );
    }

    // ─── AST walker ────────────────────────────────────────────────────────────

    private sealed class GraphWalker : CSharpSyntaxWalker
    {
        private readonly string _filePath;

        // Accumulated results
        public readonly List<GraphNodeModel> Nodes = [];
        public readonly List<RawCallRef> RawCalls = [];

        // Scope tracking
        private string _currentNamespace = "";
        private readonly Stack<string> _classStack = new();

        // For scope-attribution of call expressions (mirrors TS SymRange)
        private readonly List<(string QName, int Start, int End)> _ranges = [];

        // Deferred raw calls (line only; scope resolved after walk)
        private readonly List<(string CalleeName, int Line)> _deferredCalls = [];

        public GraphWalker(string filePath) => _filePath = filePath;

        // ── Namespace ──────────────────────────────────────────────────────────

        public override void VisitNamespaceDeclaration(NamespaceDeclarationSyntax node)
        {
            var prev = _currentNamespace;
            _currentNamespace = node.Name.ToString();
            base.VisitNamespaceDeclaration(node);
            _currentNamespace = prev;
        }

        public override void VisitFileScopedNamespaceDeclaration(
            FileScopedNamespaceDeclarationSyntax node)
        {
            _currentNamespace = node.Name.ToString();
            base.VisitFileScopedNamespaceDeclaration(node);
        }

        // ── Class / struct / record ────────────────────────────────────────────

        public override void VisitClassDeclaration(ClassDeclarationSyntax node)
            => VisitTypeDeclaration(node, () => base.VisitClassDeclaration(node));

        public override void VisitStructDeclaration(StructDeclarationSyntax node)
            => VisitTypeDeclaration(node, () => base.VisitStructDeclaration(node));

        public override void VisitRecordDeclaration(RecordDeclarationSyntax node)
            => VisitTypeDeclaration(node, () => base.VisitRecordDeclaration(node));

        private void VisitTypeDeclaration(TypeDeclarationSyntax node, Action visitChildren)
        {
            var name = node.Identifier.Text;
            var (lineStart, lineEnd) = Lines(node);
            var qname = QualifiedName(name);
            var label = ClassifyTypeLabel(name, node);
            var isPublic = HasModifier(node.Modifiers, SyntaxKind.PublicKeyword);

            var props = new Dictionary<string, object?>();
            CollectBaseTypes(node.BaseList, props);
            CollectAttributes(node.AttributeLists, props);

            Nodes.Add(new GraphNodeModel(
                Id: NodeId(_filePath, name, lineStart),
                Label: label,
                Name: name,
                QualifiedName: qname,
                FilePath: _filePath,
                LineStart: lineStart,
                LineEnd: lineEnd,
                Signature: BuildTypeSignature(node),
                Exported: isPublic,
                Async: false,
                Language: "csharp",
                Properties: props
            ));

            _ranges.Add((qname, lineStart, lineEnd));
            _classStack.Push(name);
            visitChildren();
            _classStack.Pop();
        }

        // ── Interface ──────────────────────────────────────────────────────────

        public override void VisitInterfaceDeclaration(InterfaceDeclarationSyntax node)
        {
            var name = node.Identifier.Text;
            var (lineStart, lineEnd) = Lines(node);
            var qname = QualifiedName(name);

            Nodes.Add(new GraphNodeModel(
                Id: NodeId(_filePath, name, lineStart),
                Label: "Interface",
                Name: name,
                QualifiedName: qname,
                FilePath: _filePath,
                LineStart: lineStart,
                LineEnd: lineEnd,
                Signature: $"interface {name}",
                Exported: HasModifier(node.Modifiers, SyntaxKind.PublicKeyword),
                Async: false,
                Language: "csharp",
                Properties: []
            ));

            _ranges.Add((qname, lineStart, lineEnd));
            base.VisitInterfaceDeclaration(node);
        }

        // ── Enum ───────────────────────────────────────────────────────────────

        public override void VisitEnumDeclaration(EnumDeclarationSyntax node)
        {
            var name = node.Identifier.Text;
            var (lineStart, lineEnd) = Lines(node);
            var qname = QualifiedName(name);

            Nodes.Add(new GraphNodeModel(
                Id: NodeId(_filePath, name, lineStart),
                Label: "Type",
                Name: name,
                QualifiedName: qname,
                FilePath: _filePath,
                LineStart: lineStart,
                LineEnd: lineEnd,
                Signature: $"enum {name}",
                Exported: HasModifier(node.Modifiers, SyntaxKind.PublicKeyword),
                Async: false,
                Language: "csharp",
                Properties: []
            ));

            base.VisitEnumDeclaration(node);
        }

        // ── Method ─────────────────────────────────────────────────────────────

        public override void VisitMethodDeclaration(MethodDeclarationSyntax node)
        {
            var name = node.Identifier.Text;
            var (lineStart, lineEnd) = Lines(node);
            var containingClass = _classStack.Count > 0 ? _classStack.Peek() : null;
            var qname = QualifiedName(name);
            var isAsync = HasModifier(node.Modifiers, SyntaxKind.AsyncKeyword);
            var isPublic = HasModifier(node.Modifiers, SyntaxKind.PublicKeyword);

            var attrs = CollectAttributeNames(node.AttributeLists);
            var label = ClassifyMethodLabel(name, containingClass, attrs);

            var props = new Dictionary<string, object?>();
            if (attrs.Count > 0) props["attributes"] = attrs;

            // Extract HTTP route from [Route("…")] or [HttpGet("…")] etc.
            var route = ExtractRoute(node.AttributeLists);
            if (route != null) props["route"] = route;

            Nodes.Add(new GraphNodeModel(
                Id: NodeId(_filePath, name, lineStart),
                Label: label,
                Name: name,
                QualifiedName: qname,
                FilePath: _filePath,
                LineStart: lineStart,
                LineEnd: lineEnd,
                Signature: BuildMethodSignature(node, isAsync),
                Exported: isPublic,
                Async: isAsync,
                Language: "csharp",
                Properties: props
            ));

            _ranges.Add((qname, lineStart, lineEnd));
            base.VisitMethodDeclaration(node);
        }

        // ── Constructor (for DI injection tracking) ────────────────────────────

        public override void VisitConstructorDeclaration(ConstructorDeclarationSyntax node)
        {
            // Record injected types from constructor parameters so the Node.js
            // indexer can emit INJECTS edges in its second pass.
            var containingClass = _classStack.Count > 0 ? _classStack.Peek() : null;
            if (containingClass != null)
            {
                var injected = node.ParameterList.Parameters
                    .Select(p => p.Type?.ToString())
                    .Where(t => t != null && !IsBuiltinType(t!))
                    .Select(t => t!)
                    .ToList();

                if (injected.Count > 0)
                {
                    // Attach to the parent class node via properties
                    var classQname = QualifiedName(containingClass);
                    var classNode = Nodes.FirstOrDefault(n => n.QualifiedName == classQname);
                    if (classNode != null)
                    {
                        classNode.Properties["injectedTypes"] = injected;
                    }
                }
            }

            base.VisitConstructorDeclaration(node);
        }

        // ── Invocation expressions ─────────────────────────────────────────────

        public override void VisitInvocationExpression(InvocationExpressionSyntax node)
        {
            var calleeName = node.Expression switch
            {
                MemberAccessExpressionSyntax ma => ma.Name.Identifier.Text,
                IdentifierNameSyntax id => id.Identifier.Text,
                _ => null
            };

            if (calleeName is { Length: > 1 })
            {
                var line = node.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
                _deferredCalls.Add((calleeName, line));
            }

            base.VisitInvocationExpression(node);
        }

        // ── Finalise after walk ────────────────────────────────────────────────

        public override void Visit(SyntaxNode? node)
        {
            base.Visit(node);

            // After the root visit completes, resolve scope for each deferred call
            if (node is CompilationUnitSyntax)
            {
                foreach (var (calleeName, line) in _deferredCalls)
                {
                    var scope = FindEnclosingScope(line);
                    RawCalls.Add(new RawCallRef(scope, calleeName, line));
                }
            }
        }

        // ─── Scope attribution ─────────────────────────────────────────────────

        private string FindEnclosingScope(int line)
        {
            (string QName, int Start, int End)? best = null;
            foreach (var r in _ranges)
            {
                if (line >= r.Start && line <= r.End)
                {
                    if (best is null || (r.End - r.Start) < (best.Value.End - best.Value.Start))
                        best = r;
                }
            }
            return best?.QName ?? _filePath;
        }

        // ─── Label classifiers ─────────────────────────────────────────────────

        private static string ClassifyTypeLabel(string name, TypeDeclarationSyntax node)
        {
            var attrs = CollectAttributeNames(node.AttributeLists);

            if (name.EndsWith("Controller", StringComparison.Ordinal) ||
                attrs.Any(a => a is "ApiController" or "Controller"))
                return "Controller";

            if (name.EndsWith("Repository", StringComparison.Ordinal) ||
                HasBaseType(node.BaseList, "IRepository") ||
                HasBaseType(node.BaseList, "Repository"))
                return "Repository";

            if (name.EndsWith("Middleware", StringComparison.Ordinal) ||
                attrs.Any(a => a == "Middleware"))
                return "Middleware";

            if (name.EndsWith("ViewModel", StringComparison.Ordinal) ||
                name.EndsWith("Dto", StringComparison.OrdinalIgnoreCase) ||
                name.EndsWith("Request", StringComparison.Ordinal) ||
                name.EndsWith("Response", StringComparison.Ordinal) ||
                name.EndsWith("Model", StringComparison.Ordinal))
                return "ViewModel";

            if (name.EndsWith("Service", StringComparison.Ordinal) ||
                HasBaseType(node.BaseList, "IHostedService") ||
                HasBaseType(node.BaseList, "BackgroundService"))
                return "Service";

            return "Class";
        }

        private static string ClassifyMethodLabel(
            string name, string? containingClass, List<string> attrs)
        {
            var isInController = containingClass?.EndsWith("Controller",
                StringComparison.Ordinal) ?? false;
            var hasHttpAttr = attrs.Any(a =>
                a is "HttpGet" or "HttpPost" or "HttpPut" or "HttpDelete" or
                "HttpPatch" or "HttpHead" or "HttpOptions" or "Route");

            if (isInController && (hasHttpAttr || IsPublicActionName(name)))
                return "ApiEndpoint";

            return "Function";
        }

        private static bool IsPublicActionName(string name) =>
            char.IsUpper(name[0]) && name != "Dispose";

        // ─── Attribute helpers ─────────────────────────────────────────────────

        private static List<string> CollectAttributeNames(
            SyntaxList<AttributeListSyntax> attrLists) =>
            [.. attrLists
                .SelectMany(al => al.Attributes)
                .Select(a => a.Name switch
                {
                    IdentifierNameSyntax id => id.Identifier.Text,
                    QualifiedNameSyntax qn  => qn.Right.Identifier.Text,
                    _ => null
                })
                .Where(n => n != null)
                .Select(n => n!)];

        private static void CollectAttributes(
            SyntaxList<AttributeListSyntax> attrLists,
            Dictionary<string, object?> props)
        {
            var names = CollectAttributeNames(attrLists);
            if (names.Count > 0) props["attributes"] = names;
        }

        private static string? ExtractRoute(SyntaxList<AttributeListSyntax> attrLists)
        {
            foreach (var attrList in attrLists)
            {
                foreach (var attr in attrList.Attributes)
                {
                    var attrName = attr.Name switch
                    {
                        IdentifierNameSyntax id => id.Identifier.Text,
                        QualifiedNameSyntax qn  => qn.Right.Identifier.Text,
                        _ => null
                    };

                    if (attrName is "HttpGet" or "HttpPost" or "HttpPut" or
                        "HttpDelete" or "HttpPatch" or "Route")
                    {
                        var firstArg = attr.ArgumentList?.Arguments.FirstOrDefault();
                        if (firstArg?.Expression is LiteralExpressionSyntax lit)
                            return lit.Token.ValueText;
                    }
                }
            }
            return null;
        }

        // ─── Base-type helpers ─────────────────────────────────────────────────

        private static void CollectBaseTypes(
            BaseListSyntax? baseList,
            Dictionary<string, object?> props)
        {
            if (baseList is null) return;

            var types = baseList.Types
                .Select(t => t.Type.ToString())
                .ToList();

            if (types.Count == 0) return;

            // Heuristic: interfaces start with I + uppercase
            var interfaces = types.Where(t =>
                t.Length > 1 && t[0] == 'I' && char.IsUpper(t[1])).ToList();
            var baseClasses = types.Except(interfaces).ToList();

            if (baseClasses.Count > 0) props["baseClass"] = baseClasses[0];
            if (interfaces.Count > 0)  props["interfaces"] = interfaces;
        }

        private static bool HasBaseType(BaseListSyntax? baseList, string typeName) =>
            baseList?.Types.Any(t => t.Type.ToString().Contains(typeName)) ?? false;

        // ─── Signature builders ────────────────────────────────────────────────

        private static string BuildTypeSignature(TypeDeclarationSyntax node)
        {
            var kind = node switch
            {
                RecordDeclarationSyntax r => r.ClassOrStructKeyword.IsKind(SyntaxKind.StructKeyword)
                    ? "record struct" : "record",
                StructDeclarationSyntax => "struct",
                _ => "class"
            };

            var bases = node.BaseList?.Types
                .Select(t => t.Type.ToString())
                .ToList();

            return bases?.Count > 0
                ? $"{kind} {node.Identifier.Text} : {string.Join(", ", bases)}"
                : $"{kind} {node.Identifier.Text}";
        }

        private static string BuildMethodSignature(
            MethodDeclarationSyntax node, bool isAsync)
        {
            var ret = node.ReturnType.ToString();
            var name = node.Identifier.Text;
            var parms = string.Join(", ",
                node.ParameterList.Parameters.Select(p =>
                    $"{p.Type} {p.Identifier.Text}"));
            return isAsync
                ? $"async {ret} {name}({parms})"
                : $"{ret} {name}({parms})";
        }

        // ─── Misc helpers ──────────────────────────────────────────────────────

        private string QualifiedName(string symbolName)
        {
            var parts = new List<string> { _filePath };
            if (_currentNamespace.Length > 0) parts.Add(_currentNamespace);
            foreach (var cls in _classStack.Reverse()) parts.Add(cls);
            parts.Add(symbolName);
            return string.Join(":", parts);
        }

        private static (int start, int end) Lines(SyntaxNode node)
        {
            var span = node.GetLocation().GetLineSpan();
            return (span.StartLinePosition.Line + 1,
                    span.EndLinePosition.Line + 1);
        }

        private static bool HasModifier(SyntaxTokenList mods, SyntaxKind kind) =>
            mods.Any(m => m.IsKind(kind));

        private static string NodeId(string filePath, string name, int line)
        {
            var input = $"{filePath}:{name}:{line}";
            var hash = MD5.HashData(Encoding.UTF8.GetBytes(input));
            return Convert.ToHexString(hash)[..16].ToLowerInvariant();
        }

        private static bool IsBuiltinType(string typeName) =>
            typeName is "string" or "int" or "long" or "bool" or "double" or "float"
                or "decimal" or "object" or "byte" or "char" or "short" or "uint"
                or "ulong" or "ushort" or "sbyte" or "DateTime" or "Guid"
                or "ILogger" or "IConfiguration" or "CancellationToken"
            || typeName.StartsWith("ILogger<", StringComparison.Ordinal)
            || typeName.StartsWith("IOptions<", StringComparison.Ordinal);
    }
}
