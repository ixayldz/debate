# Repository Guidelines

## Project Structure & Module Organization
`src/` contains all runtime code. Main entrypoint is `src/app.ts`.
Feature code is grouped by module under `src/modules/` (`auth`, `user`, `room`, `moderation`, `mic-request`) with `*.controller.ts`, `*.service.ts`, `*.repository.ts`, and `*.routes.ts` patterns.
Shared code lives in:
- `src/common/` for guards, filters, base repositories, and utilities
- `src/config/` for DB/Redis/logger/metrics/livekit setup
- `src/middleware/` for HTTP middleware
- `src/types/` for shared types/enums
- `src/docs/` for Swagger setup

`dist/` is build output from TypeScript. Do not edit it directly.

## Build, Test, and Development Commands
- `npm run dev`: run server with `tsx` watch mode from `src/app.ts`
- `npm run build`: compile TypeScript to `dist/`
- `npm start`: run compiled server (`dist/app.js`)
- `npm run lint`: lint `src/**/*.ts` with ESLint
- `npm run lint:fix`: auto-fix lint issues where possible
- `npm test` / `npm run test:unit`: run unit tests under `tests/common/**/*.test.ts`
- `npm run test:integration`: run real infra/API smoke checks (`smoke:infra` + `smoke:api`)
- `npm run preflight:prod`: verify DB, Redis, LiveKit, and SMTP connectivity with current env
- `npm run test:all`: run both unit + integration suites
- `docker compose up --build`: run API + Redis locally in containers

## Coding Style & Naming Conventions
Use TypeScript (Node 20+, ES2022, NodeNext modules). Follow existing style:
- 2-space indentation
- single quotes
- semicolons enabled
- file names: lowercase with role suffixes (example: `room.service.ts`)
- classes/interfaces: `PascalCase`; variables/functions: `camelCase`
- keep import aliases consistent (`@modules/*`, `@common/*`, `@config/*`)

Linting is configured in `.eslintrc.json`; `no-unused-vars` is strict, `any` is warning-only.

## Testing Guidelines
Jest + `ts-jest` is configured with `tests/setup.ts`.
Unit tests are intentionally focused on `tests/common/**` (validation and shared utility behavior).
Integration confidence comes from smoke checks against real dependencies (`npm run test:integration`); avoid adding mock-heavy tests for critical backend flows.

## Commit & Pull Request Guidelines
Git history is not available in this workspace export (`.git` missing), so no project-specific commit pattern could be derived.
Use Conventional Commits (for example: `feat(room): add handover timeout recovery`).
PRs should include:
- clear summary and scope
- linked issue/ticket
- test evidence (`npm test`, `npm run lint`)
- API contract notes/screenshots for endpoint changes (Swagger or sample payloads)

## Security & Configuration Tips
Copy `.env.example` to `.env` for local setup. Never commit secrets.
Use strong JWT/OAuth credentials and validate Redis/PostgreSQL connectivity via `/health` before opening PRs.
