# Security Guidelines

## Principles
- protect credentials
- minimize exposure
- validate external input
- do not leak sensitive information

## Secrets
- do not hardcode passwords, API keys, or tokens
- store secrets in configuration or secret management
- never commit real secrets to source control

## Logging
- never log raw tokens
- never log passwords
- avoid logging unfiltered sensitive payloads

## API Exposure
- protect operational endpoints if exposed beyond an internal network
- consider authentication/authorization for manual sync endpoints
- restrict diagnostic endpoints as needed

## Input Validation
- validate all incoming API requests
- validate external payload assumptions before processing
