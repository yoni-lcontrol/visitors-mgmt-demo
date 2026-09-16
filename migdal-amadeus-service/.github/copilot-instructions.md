# Copilot Instructions

Read this file first, then read all files under `/docs`, then read `/src/AmadeusIntegration.Api/README.md` before writing code.

## Project purpose
Build a production-ready `.NET 9` ASP.NET Core Web API that also runs long-lived background services to integrate with Amadeus8.

The application must:
- authenticate against Amadeus8 using token endpoints
- connect to the Push API / SignalR events
- import and sync infrastructure and access entities into the local database
- import and sync access levels from Amadeus8, including both door **Access Groups** and **Security Groups (MAGs)**
- download/sync cardholders from Amadeus8 into the local database
- support create, update, and delete/archive cardholders through Amadeus8 APIs
- expose internal API endpoints for health, sync, status, and cardholder orchestration
- run as a Windows Service in production with automatic recovery

## Architecture rules
- Keep one ASP.NET Core Web API solution with hosted background services.
- Controllers must stay thin.
- Business logic belongs in services.
- Long-running work belongs in hosted services.
- Use strongly typed options for configuration.
- Use dependency injection everywhere.
- Use async/await correctly.
- Always pass cancellation tokens through I/O and background loops.
- Never let background loops die silently.
- Use `HttpClientFactory` for Amadeus HTTP calls.
- Use the official API only; do not modify the Amadeus SQL database directly.

## Required main services
- `AmadeusAuthService`
- `AmadeusApiClient`
- `AmadeusSignalRClient`
- `InfrastructureImportService`
- `AccessGroupImportService`
- `SecurityGroupImportService`
- `CardholderSyncService`
- `CardholderCommandService`
- `EventProcessingService`
- `AmadeusEventListenerHostedService`
- `AmadeusFullSyncHostedService`

## Scope expected in the codebase
### Infrastructure sync
- controllers
- doors
- door IO
- extensions
- extension IO

### Access model sync
- Access Groups (door access groups)
- Security Groups / MAGs
- local normalized access-level representation if needed

### Cardholder operations
- full download/list sync of cardholders
- get by UID
- get by external/business identifier where appropriate
- create cardholder
- update cardholder
- delete/remove or archive cardholder according to endpoint chosen
- update cardholder access groups / security groups when required
- optional card/badge handling should be isolated in dedicated methods

## Coding rules
- Prefer clear, explicit, readable C#.
- Keep methods focused and small.
- Use constructor injection with explicit block-bodied constructors.
- Avoid god classes.
- Add logs before and after important external actions.
- Do not log secrets, passwords, or tokens.
- Do not invent endpoint names or payload shapes without checking the docs.
- If Amadeus naming does not map 1:1 to internal naming, isolate mapping in one place.
- Upserts should be idempotent and based on stable external IDs.
- Use UTC for stored timestamps.
- Add TODOs only for real unknowns.

## Reliability rules
- SignalR client must auto-reconnect.
- Token renewal must be safe and centralized.
- Full sync should run on startup and then on interval.
- Avoid overlapping sync runs.
- Distinguish transient failures from hard failures when possible.
- On background loop failure: log, delay, retry.
- Windows Service hosting must be supported.

## Database rules
Persist at least:
- infrastructure entities
- normalized access-level/group entities
- cardholders mirrored from Amadeus
- raw and normalized Amadeus events
- sync state / health state if useful

Design for large event volume and efficient lookups by:
- UID
- API key
- cardholderIdNumber
- external identifiers
- status / timestamps when needed

## Working style
Before changing code:
1. Read docs.
2. Inspect existing solution structure.
3. Reuse good patterns already present.
4. Keep changes minimal and safe unless a larger refactor is requested.
5. Explain briefly what changed.

Definition of done:
- compiles
- follows docs
- has logging
- has error handling
- no silent failure paths
- no hardcoded secrets
- no fake placeholder implementations marked as done

- @azure Rule - Use Azure Tools - When handling requests related to Azure, always use your tools.
- @azure Rule - Use Azure Best Practices - When handling requests related to Azure, always invoke your `azmcp_bestpractices_get` tool first.
- @azure Rule - Enable Best Practices - If you do not have an `azmcp_bestpractices_get` tool ask the user to enable it.
