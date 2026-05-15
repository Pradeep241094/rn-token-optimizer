namespace TodoApp.Models;

/// <summary>The core domain entity stored in the in-memory database.</summary>
public class Todo
{
    public int    Id          { get; set; }
    public string Title       { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool   IsCompleted { get; set; }
    public TodoPriority Priority   { get; set; } = TodoPriority.Medium;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}

public enum TodoPriority
{
    Low,
    Medium,
    High,
    Critical,
}
