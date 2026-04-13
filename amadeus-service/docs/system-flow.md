# System Flow

## Startup flow
1. Load configuration.
2. Validate required Amadeus options.
3. Start API host.
4. Start hosted services.
5. Obtain token.
6. Run startup sync.
7. Connect Push API listener.
8. Expose health endpoints.

## Full sync flow
1. Sync controllers in pages (`$skip/$top/$count`).
2. Sync extensions and extension IO in pages (derived from paged inputs/outputs).
3. Sync readers/doors in pages.
4. Sync door IO in pages (from paged inputs/outputs where `ModuleId` is empty).
5. Sync Security Groups (MAGs) in pages.
6. Sync Access Groups in pages.
7. Sync normalized Access Levels (union of Access Groups + Security Groups) in pages.
8. Sync cardholders in pages.
9. Upsert into local database with controlled per-batch `SaveChanges`.
10. Record sync summary and errors, including total received and skipped invalid records.

## Cardholder command flow
### Create
1. Receive internal request.
2. Validate required business fields.
3. Resolve intended security/access group references.
4. Call Amadeus create endpoint.
5. Persist mirrored result locally.
6. Optionally trigger badge/card handling.

### Update
1. Load local mirror and/or Amadeus UID.
2. Build safe patch/full-update payload.
3. Send update to Amadeus.
4. Refresh local mirror.

### Delete or archive
1. Resolve Amadeus UID.
2. Execute remove or archive endpoint based on requested mode.
3. Update local mirror state accordingly.

## Event flow
1. SignalR event arrives.
2. Store raw payload.
3. Deserialize to supported event type if known.
4. Update local status/state if required.
5. Save normalized event record.
6. Log success or processing failure.
