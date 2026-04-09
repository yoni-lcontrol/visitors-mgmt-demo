# Copilot Instructions

## Repository Context

This repository contains:
- Angular frontend
- NestJS backend
- Microsoft SQL Server database

Always inspect the relevant docs in `docs/` before making changes.

## Required docs to follow

- `docs/development-rules.md`
- `docs/backend-structure.md`
- `docs/frontend-structure.md`
- `docs/auth-flow.md`
- `docs/permissions-model.md`
- `docs/api-validation-workflow.md`

## API change rule

Any backend API change must:
- update or add relevant tests
- run relevant tests
- fix failures before completion
- update docs if contract changes

## Layering rules

- controllers stay thin
- business logic belongs in services
- DTOs validate input
- permission enforcement is backend responsibility
- do not introduce new architectural patterns without need

## Output rule

When completing a task, always summarize:
- files changed
- endpoints changed
- tests added/updated
- commands run
- final result