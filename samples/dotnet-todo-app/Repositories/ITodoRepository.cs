using TodoApp.Models;

namespace TodoApp.Repositories;

/// <summary>
/// Repository contract — detected as Interface label.
/// TodoRepository implements this, creating an IMPLEMENTS edge in the graph.
/// </summary>
public interface ITodoRepository
{
    Task<IReadOnlyList<Todo>> GetAllAsync(bool? completedFilter = null);
    Task<Todo?>               GetByIdAsync(int id);
    Task<Todo>                AddAsync(Todo todo);
    Task<Todo?>               UpdateAsync(Todo todo);
    Task<bool>                DeleteAsync(int id);
    Task<int>                 CountAsync(bool? completedFilter = null);
}
