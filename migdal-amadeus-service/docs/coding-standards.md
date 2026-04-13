# Coding Standards

## General Style
- prefer readability over brevity
- use explicit names
- keep methods focused
- use guard clauses where they improve clarity
- avoid unnecessary abstractions

## Constructors
Use explicit block-style constructors.

```csharp
public MyService(IDependency dependency)
{
    _dependency = dependency;
}
```

Do not use expression-bodied constructors.

## Async Rules
- use async/await for IO operations
- pass cancellation tokens where appropriate
- do not block on async with `.Result` or `.Wait()`

## Service Boundaries
- controllers stay thin
- services contain business logic
- hosted services orchestrate loops, not business rules

## Logging Style
- log before/after important external operations
- keep messages clear and grammatical
- do not log secrets

## TODO Style
Only add TODO comments for real unknowns.
Each TODO should say what is missing and where the information should come from.
