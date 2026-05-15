namespace TodoApp.Models;

/// <summary>
/// Response DTO — detected as ViewModel label by rn-token-optimizer
/// (class name ends with "Dto").
/// </summary>
public class TodoDto
{
    public int         Id          { get; set; }
    public string      Title       { get; set; } = string.Empty;
    public string      Description { get; set; } = string.Empty;
    public bool        IsCompleted { get; set; }
    public TodoPriority Priority   { get; set; }
    public DateTime    CreatedAt   { get; set; }
    public DateTime?   CompletedAt { get; set; }

    public static TodoDto FromEntity(Todo todo) => new()
    {
        Id          = todo.Id,
        Title       = todo.Title,
        Description = todo.Description,
        IsCompleted = todo.IsCompleted,
        Priority    = todo.Priority,
        CreatedAt   = todo.CreatedAt,
        CompletedAt = todo.CompletedAt,
    };
}
