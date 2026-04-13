# Database Guidelines

## General Rules
- Use UTC timestamps only.
- Use proper primary keys.
- Store stable Amadeus external IDs explicitly.
- Add indexes for high-frequency lookups.
- Keep schema clear and maintainable.

## Volume Expectations
The event log table can become large.
Design accordingly:
- index carefully
- avoid wide indexing on large JSON columns
- consider partitioning later if volume grows significantly
- keep event inserts append-friendly

## Import Persistence Rules
- Upsert imported infrastructure by stable external ID.
- Do not duplicate records for the same external object.
- Keep `updatedUtc` refreshed on change.
- Prefer soft deactivation over hard deletion unless business rules require removal.

## Event Storage Rules
- Preserve raw payload for diagnostics where useful.
- Keep normalized summary fields for filtering.
- Avoid expensive relational operations inside the event hot path unless needed.

## Index Suggestions
At minimum consider indexes on:
- external IDs
- controller foreign keys
- event timestamps
- event categories/types
- active status if used often in filters

## Migration Discipline
- keep migrations small and reviewable
- document important schema decisions
- avoid mixing unrelated changes in one migration
- test migrations on a local copy before production deployment
