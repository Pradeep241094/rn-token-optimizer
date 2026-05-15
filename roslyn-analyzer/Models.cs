namespace RnTokenOptimizer.Roslyn;

/// <summary>
/// Mirrors the TypeScript GraphNode interface so the Node.js indexer can
/// deserialise the output directly into its existing SQLite graph store.
/// </summary>
public record GraphNodeModel(
    string Id,
    string Label,
    string Name,
    string QualifiedName,
    string FilePath,
    int LineStart,
    int LineEnd,
    string Signature,
    bool Exported,
    bool Async,
    string Language,
    Dictionary<string, object?> Properties
);

/// <summary>Mirrors RawCallRef from the TypeScript graph/types.ts.</summary>
public record RawCallRef(
    string CallerQualifiedName,
    string CalleeName,
    int Line
);

/// <summary>
/// Mirrors ParsedFile from the TypeScript graph/types.ts.
/// RawNavigates and RawRenders are always empty for C# (no JSX, no navigation).
/// </summary>
public record ParsedFileResult(
    string FilePath,
    List<GraphNodeModel> Nodes,
    List<string> ImportedFiles,
    List<RawCallRef> RawCalls,
    List<object> RawNavigates,
    List<object> RawRenders
);

public record ErrorResult(string FilePath, string Error);

public record AnalysisOutput(
    List<ParsedFileResult> Files,
    List<ErrorResult> Errors
);
