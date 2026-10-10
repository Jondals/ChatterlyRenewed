# Contributing to Chatterly-Renewed

Thank you for wanting to help. This guide is short on purpose.

## Set up

1. Install Node.js 20 or newer and pnpm.
2. `pnpm install:all` installs the root, backend and frontend packages.
3. `pnpm dev` starts the backend (port 3000) and the frontend (port 4200) together.

## Before you open a pull request

- `pnpm typecheck` must pass for both projects.
- `pnpm test` runs the single end-to-end test (two real browsers, a real call). It must end with `ALL CORRECT`. On Windows you can also run `test/chatterly-test.exe`.
- Keep the changes small and focused: one idea per pull request.

## Code style

- All code, identifiers and comments are in English. User-facing text goes through the translation pipe, and every new string needs an entry in `frontend/src/app/core/i18n/es.ts` (`node frontend/scripts/i18n.mjs --check` lists what is missing).
- Every file starts with a header comment saying what it does, and every function has a short comment.
- No lambda (arrow) functions: use named functions or `bind`.
- Format with Prettier (`pnpm --dir frontend exec prettier --write .`).
- Keep the cursor, the animations and the hover states consistent with the rest of the interface.

## Security

Never log, store or send message text, passwords or keys. If you find a vulnerability do not open a public issue: read [SECURITY.md](SECURITY.md).

## Adding a language

Translations live in one dictionary per language in `frontend/src/app/core/i18n/`. Copy `es.ts`, translate the values and register the language in `i18n.service.ts`.
