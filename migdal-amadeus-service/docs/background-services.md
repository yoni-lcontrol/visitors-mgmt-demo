# Background Services

## Required hosted services
### `AmadeusEventListenerHostedService`
Responsibilities:
- authenticate if needed
- connect to Push API / SignalR
- subscribe to supported events: `IOEventArrived`, `AccessEventArrived`, `GeneralEventArrived`, `AuditEventArrived`, `CommEventArrived`, `TechnicalEventArrived`, `AlarmEventArrived`, `StatusUpdate`
- reconnect automatically via `IRetryPolicy` delay
- never die silently
- delegates each event to `IEventProcessingService` in a DI scope
- passes `IHostApplicationLifetime.ApplicationStopping` to per-event processing so shutdown is honored

### `AmadeusFullSyncHostedService`
Responsibilities:
- run startup sync
- run recurring sync on interval
- avoid overlap between sync runs
- trigger backend full sync endpoint (`/api/sync/full`) on startup and interval

Notes:
- Runs independently from the SignalR listener hosted service.
- Failure in backend full sync must not stop SignalR listener startup/reconnect loop.

### `BackendEquipmentStartupLoadHostedService`
Responsibilities:
- load central equipment data from backend APIs at startup
- prepare in-memory snapshot for comparison during equipment import flows
- log clear start/completion/failure states

Notes:
- Startup load failure is logged clearly and does not stop the service host.
- Import flows do not load central equipment from backend on-demand.
- Comparison uses the startup-loaded local snapshot only.

## Optional hosted services
### `AmadeusTokenWarmupHostedService`
- validate auth configuration at startup
- proactively renew token

### `AmadeusHealthStateHostedService`
- store heartbeat / last successful listener and sync timestamps

## Reliability rules
- every background loop must honor cancellation tokens
- every exception must be logged
- transient failures should delay and retry
- sync loops must not run concurrently unless designed explicitly
