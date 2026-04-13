# Logging and Monitoring

## Logging Goals
Logs must help operators answer:
- is the service running?
- is the listener connected?
- when did the last sync run?
- did token retrieval fail?
- are events being processed?
- what failed and where?

## What to Log
- service startup and shutdown
- token acquisition and renewal attempts
- API call start/failure/success summaries
- SignalR connect/disconnect/reconnect
- sync cycle start and end
- counts of imported/updated/failed entities
- event receipt and event persistence summaries
- configuration validation failures

## What Not to Log
- passwords
- API keys unless masked and explicitly approved
- raw tokens
- unnecessarily large full payloads at high-volume levels

## Log Message Style
- keep messages in English
- make them specific and operationally useful
- include IDs and counts when helpful
- avoid vague logs such as "something failed"

## Monitoring Suggestions
Expose health/status endpoints and optionally metrics for:
- listener connected state
- last successful token refresh
- last successful sync
- recent event throughput
- recent failures
