using TodoApp.Models;

namespace TodoApp.Services;

/// <summary>
/// Service contract — detected as Interface label.
/// TodoService implements this, creating an IMPLEMENTS edge in the graph.
/// </summary>
public interface ITodoService
{
    Task<PagedResult<TodoDto>> GetAllAsync(int page, int pageSize, bool? completedFilter = null);
    Task<TodoDto?>             GetByIdAsync(int id);
    Task<TodoDto>              CreateAsync(CreateTodoRequest request);
    Task<TodoDto?>             UpdateAsync(int id, UpdateTodoRequest request);
    Task<bool>                 DeleteAsync(int id);
    Task<TodoDto?>             MarkCompleteAsync(int id);
    Task<TodoDto?>             MarkIncompleteAsync(int id);
    Task<IReadOnlyList<TodoDto>> GetByPriorityAsync(TodoPriority priority);
}
