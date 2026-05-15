using System.Diagnostics;

namespace TodoApp.Middleware;

/// <summary>
/// Logs method, path, status code, and elapsed time for every request.
///
/// Graph label: Middleware (class name ends with "Middleware")
/// </summary>
public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(
        RequestDelegate next,
        ILogger<RequestLoggingMiddleware> logger)
    {
        _next   = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var sw = Stopwatch.StartNew();

        try
        {
            await _next(context);
        }
        finally
        {
            sw.Stop();
            var statusCode = context.Response.StatusCode;
            var method     = context.Request.Method;
            var path       = context.Request.Path;
            var elapsed    = sw.ElapsedMilliseconds;

            var level = statusCode >= 500 ? LogLevel.Error
                      : statusCode >= 400 ? LogLevel.Warning
                      : LogLevel.Information;

            _logger.Log(level, "{Method} {Path} → {Status} ({Elapsed}ms)",
                method, path, statusCode, elapsed);
        }
    }
}
