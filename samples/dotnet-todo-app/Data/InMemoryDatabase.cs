using TodoApp.Models;

namespace TodoApp.Data;

/// <summary>
/// Thread-safe in-memory store — no EF Core required for this sample.
/// Registered as a singleton so the repository shares one instance.
/// </summary>
public class InMemoryDatabase
{
    private readonly List<Todo> _todos = [];
    private readonly object     _lock  = new();
    private int _nextId = 1;

    public InMemoryDatabase() => Seed();

    public IReadOnlyList<Todo> GetAll()
    {
        lock (_lock) return [.. _todos];
    }

    public Todo? FindById(int id)
    {
        lock (_lock) return _todos.FirstOrDefault(t => t.Id == id);
    }

    public Todo Add(Todo todo)
    {
        lock (_lock)
        {
            todo.Id = _nextId++;
            _todos.Add(todo);
            return todo;
        }
    }

    public bool Update(Todo updated)
    {
        lock (_lock)
        {
            var idx = _todos.FindIndex(t => t.Id == updated.Id);
            if (idx < 0) return false;
            _todos[idx] = updated;
            return true;
        }
    }

    public bool Delete(int id)
    {
        lock (_lock)
        {
            var todo = _todos.FirstOrDefault(t => t.Id == id);
            if (todo is null) return false;
            _todos.Remove(todo);
            return true;
        }
    }

    private void Seed()
    {
        var seeds = new[]
        {
            new Todo { Title = "Set up CI/CD pipeline",      Priority = TodoPriority.High,     Description = "Configure GitHub Actions for build and test." },
            new Todo { Title = "Write unit tests",            Priority = TodoPriority.High,     Description = "Cover service and repository layers." },
            new Todo { Title = "Add Swagger documentation",   Priority = TodoPriority.Medium,   Description = "Enable Swashbuckle and annotate all endpoints." },
            new Todo { Title = "Review PR backlog",           Priority = TodoPriority.Medium,   Description = "Go through 5 open pull requests." },
            new Todo { Title = "Update NuGet dependencies",   Priority = TodoPriority.Low,      Description = "Check for security advisories." },
        };

        foreach (var seed in seeds)
            Add(seed);
    }
}
