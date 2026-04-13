# Local Development

## Prerequisites
- .NET 9 SDK
- local SQL Server or target DB
- valid Amadeus test environment access if available
- Visual Studio Code

## Typical Steps
1. clone the repository
2. restore packages
3. configure local settings
4. create/update database
5. run the API
6. test endpoints through Swagger or HTTP client

## Common Commands
```bash
dotnet restore
dotnet build
dotnet run --project src/AmadeusIntegration.Api
```

## Database Commands
Document the exact EF migration commands used by the project here when migrations are added.

## Notes
- keep real secrets out of source-controlled config
- use a local settings file or secrets store
