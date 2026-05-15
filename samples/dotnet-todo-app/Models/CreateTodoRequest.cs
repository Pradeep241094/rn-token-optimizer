using System.ComponentModel.DataAnnotations;

namespace TodoApp.Models;

/// <summary>Request ViewModel — detected as ViewModel label by rn-token-optimizer.</summary>
public class CreateTodoRequest
{
    [Required]
    [MinLength(1)]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    public TodoPriority Priority { get; set; } = TodoPriority.Medium;
}
