# Error Handling and Retries

## Principles
- fail safely
- log clearly
- retry only when retry makes sense
- do not hide errors
- keep recovery predictable

## Transient Failures
Examples:
- network interruption
- temporary Amadeus API unavailability
- SignalR disconnect
- timeout

Handling:
- log warning/error with context
- retry after delay
- keep the process alive

## Permanent or Configuration Failures
Examples:
- invalid base URL
- wrong credentials
- unsupported payload contract
- missing required configuration

Handling:
- fail fast where appropriate
- produce clear startup or operational diagnostics
- do not retry infinitely when the error is clearly permanent without backoff or operator action

## Background Loop Rule
Top-level background loops must always be wrapped so a single exception does not terminate the worker permanently.

## Retry Guidance
- use bounded or delayed retry loops
- avoid busy loops
- avoid stacking duplicate retries at multiple layers unnecessarily
- keep retry delay configurable if needed

## Controller Error Handling
- return meaningful status codes
- do not expose stack traces in production responses
- log full internal exception details server-side
