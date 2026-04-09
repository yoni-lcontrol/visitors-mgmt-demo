# API Validation Workflow

When backend API code changes:

1. identify affected endpoints
2. identify related DTOs, guards, services, and repositories
3. update unit tests
4. update integration or controller tests
5. update e2e tests for main API flows
6. run the relevant test suite
7. fix failures
8. rerun until passing

## Standard commands

### Backend
- install: `npm install`
- unit tests: `npm run test`
- e2e tests: `npm run test:e2e`
- lint: `npm run lint`

## Definition of done

A backend API task is complete only if:
- implementation is complete
- tests were updated or added
- tests pass
- Swagger/docs updated if contract changed