# Scheduled Tasks

All backend cron jobs / scheduled tasks are centralized in this folder.

Each task file is a thin wrapper that defines **only** the schedule and triggers the relevant service method. Business logic stays in the domain service.

## Tasks

| Task File | Class | Schedule | Description | Service Called |
|---|---|---|---|---|
| `ad-sync.task.ts` | `AdSyncTask` | Daily at 01:00 AM (`0 1 * * *`) | Synchronizes users from Active Directory configurations | `AdSyncService.syncAll()` (users module) |
| `retention-cleanup.task.ts` | `RetentionCleanupTask` | Daily at midnight (`0 0 * * *`) | Deletes expired audit logs, visit records, and completed device command logs based on retention settings | `RetentionCleanupService.handleRetentionCleanup()` (settings module) |
| `visitor-auto-checkout.task.ts` | `VisitorAutoCheckoutTask` | Daily at midnight (`0 0 * * *`) | Auto-checks-out visitors still in Arrived/CheckedIn state whose visit has ended | `VisitsService.autoCheckOutExpiredVisitors()` (visitors module) |
| `token-cleanup.task.ts` | `TokenCleanupTask` | Daily at 01:00 AM (`0 1 * * *`) | Purges expired and revoked refresh tokens from the RefreshTokens table | `AuthService.cleanupExpiredTokens()` (auth module) |

## Architecture

```
scheduled-tasks/
├── scheduled-tasks.module.ts   # Module importing domain modules, providing tasks
├── ad-sync.task.ts             # Cron trigger for AD user sync
├── ad-sync.task.spec.ts        # Tests
├── retention-cleanup.task.ts   # Cron trigger for data retention cleanup
├── retention-cleanup.task.spec.ts # Tests
├── visitor-auto-checkout.task.ts      # Cron trigger for auto visitor checkout
├── visitor-auto-checkout.task.spec.ts # Tests
├── token-cleanup.task.ts              # Cron trigger for refresh token cleanup
├── token-cleanup.task.spec.ts         # Tests
└── README.md                   # This file
```

## Adding a New Scheduled Task

1. Create `<name>.task.ts` in this folder with a `@Cron` decorator.
2. Inject the domain service and call it from the cron handler.
3. Keep business logic in the domain service, not in the task file.
4. Register the task class in `scheduled-tasks.module.ts` providers.
5. Import the domain module in `scheduled-tasks.module.ts` if not already imported.
6. Add a test file `<name>.task.spec.ts`.
7. Update this README table.
