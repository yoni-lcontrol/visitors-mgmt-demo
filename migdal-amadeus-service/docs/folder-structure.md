# Folder Structure

## Recommended Structure

```text
/src/AmadeusIntegration.Api
  /Controllers
  /HostedServices
  /Services
  /Data
  /Entities
  /Models
  /DTOs
  /Configurations
```

## Placement Rules
- `Controllers`: HTTP endpoints only
- `HostedServices`: `BackgroundService` implementations
- `Services`: integration and business logic
- `Data`: `DbContext`, EF configuration, migrations support
- `Entities`: persistence models
- `Models` / `DTOs`: API contracts and options
- `Configurations`: options validation and setup helpers
