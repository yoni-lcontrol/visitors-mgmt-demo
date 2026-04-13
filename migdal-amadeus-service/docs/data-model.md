# Data Model

## Main tables
### Infrastructure
- `controllers`
- `doors`
- `door_ios`
- `extensions`
- `extension_ios`

### Access
- `security_groups`
- `access_groups`
- `access_levels` (normalized read model of both Access Groups and Security Groups)

Suggested `access_levels` columns:
- `id`
- `amadeus_uid`
- `source_type` (`AccessGroup` or `SecurityGroup`)
- `api_key`
- `name`
- `description`
- `is_active`
- `created_utc`
- `updated_utc`

Suggested `access_levels` indexes:
- unique composite index on (`source_type`, `amadeus_uid`)
- index on `api_key`
- index on `is_active`

### Cardholders
- `cardholders`
- optional `cardholder_cards`
- optional `cardholder_group_links`

### Events
- `amadeus_raw_events`
- `amadeus_events`

### Sync / operational
- `sync_runs`
- `listener_state` or equivalent lightweight state table if needed

## Minimum suggested cardholder columns
- local `id`
- `amadeus_uid`
- `cardholder_id_number`
- `first_name`
- `last_name`
- `description`
- `cardholder_type_uid`
- `department_uid`
- `status`
- `from_date_valid_utc`
- `to_date_valid_utc`
- `is_from_date_active`
- `is_to_date_active`
- `security_group_uid`
- `security_group_api_key`
- `access_group_uids_raw`
- `access_group_api_keys_raw`
- `last_download_time_utc`
- `is_deleted`
- `is_archived`
- `created_utc`
- `updated_utc`

## Index suggestions
- unique index on `amadeus_uid`
- index on `cardholder_id_number`
- index on `security_group_uid`
- index on `status`
- indexes on event timestamps and event types
- indexes on API keys for security/access groups
