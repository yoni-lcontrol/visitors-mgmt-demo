# Reusable Copilot Prompts

## Backend API Change

```text
Review the backend API change in the affected NestJS module.

Follow:
- docs/development-rules.md
- docs/backend-structure.md
- docs/auth-flow.md
- docs/permissions-model.md
- docs/api-validation-workflow.md

Tasks:
1. identify the changed endpoints
2. inspect affected DTOs, services, guards, and entities
3. implement the required change
4. add or update relevant unit/integration/e2e tests
5. run relevant tests
6. if tests fail, fix and rerun
7. summarize:
   - files changed
   - endpoints affected
   - tests added/updated
   - commands run
   - final result