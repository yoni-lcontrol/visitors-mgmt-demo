# Testing Strategy

## Unit tests
- token caching and renewal behavior
- endpoint payload mapping
- cardholder create/update/delete request builders
- access group / security group mapping
- infrastructure mapping for door/IO/internal abstractions
- event deserialization and processing

## Integration tests
- internal API endpoints
- health endpoints
- sync orchestration endpoints
- cardholder command endpoints

## Contract tests / stubs
Prefer mocking Amadeus HTTP and SignalR boundaries so core business logic is testable without a live server.
