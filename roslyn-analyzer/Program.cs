using System.Text.Json;
using System.Text.Json.Serialization;
using RnTokenOptimizer.Roslyn;

// ─── JSON options ──────────────────────────────────────────────────────────────
// camelCase to match the TypeScript interface conventions used by the Node.js
// graph indexer that reads this output.
var jsonOptions = new JsonSerializerOptions
{
    PropertyNamingPolicy        = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition      = JsonIgnoreCondition.WhenWritingNull,
    WriteIndented               = false,
};

// ─── Input protocol ────────────────────────────────────────────────────────────
// stdin:    JSON array of absolute file paths, e.g. ["/app/src/Foo.cs", ...]
// args[0]:  project root directory (required for computing relative paths)

var rootDir = args.Length > 0 ? args[0] : Directory.GetCurrentDirectory();

string rawInput;
try
{
    rawInput = await Console.In.ReadToEndAsync();
}
catch (Exception ex)
{
    WriteError($"Failed to read stdin: {ex.Message}");
    return 1;
}

string[] filePaths;
try
{
    filePaths = JsonSerializer.Deserialize<string[]>(rawInput, jsonOptions)
                ?? [];
}
catch
{
    // Fallback: treat as newline-separated list
    filePaths = rawInput.Split('\n',
        StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

// ─── Parse each file ───────────────────────────────────────────────────────────

var files  = new List<ParsedFileResult>();
var errors = new List<ErrorResult>();

foreach (var filePath in filePaths)
{
    if (!File.Exists(filePath))
    {
        errors.Add(new ErrorResult(filePath, "File not found"));
        continue;
    }

    try
    {
        var parser = new CSharpFileParser(rootDir);
        files.Add(parser.Parse(filePath));
    }
    catch (Exception ex)
    {
        errors.Add(new ErrorResult(filePath, ex.Message));
    }
}

// ─── Output ────────────────────────────────────────────────────────────────────

Console.WriteLine(JsonSerializer.Serialize(
    new AnalysisOutput(files, errors),
    jsonOptions));

return 0;

// ─── Helpers ───────────────────────────────────────────────────────────────────

static void WriteError(string msg) =>
    Console.Error.WriteLine($"[rn-token-optimizer-roslyn] ERROR: {msg}");
