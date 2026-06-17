# Pull Request

## Ticket

<!-- Link the tracked ticket this PR resolves -->

US-E

## Description

<!-- What changed and why. Be specific — "implement stuff" is not a description. -->

## Type of Change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `refactor` — code restructuring, no behaviour change
- [ ] `perf` — performance improvement
- [ ] `test` — test additions or updates
- [ ] `docs` — documentation only
- [ ] `chore` — deps, configs, CI
- [ ] `ci` — CI configuration

## Package(s) Affected

- [ ] Server (`src/`)
- [ ] Client (`client/`)
- [ ] Both

## How Has This Been Tested?

<!-- Describe what you ran. -->

- [ ] Unit tests (`pnpm test` / `pnpm --filter client test`)
- [ ] Manual test via Swagger UI or Postman
- [ ] Manual test in the HITL UI

## Test Evidence

<!-- Required. Attach a screenshot of Swagger/Postman showing the request and response,
     or a browser screenshot for UI changes. PRs without this will not be reviewed. -->

## Checklist

- [ ] PR title follows `type(scope): US-E<num> short description` format
- [ ] Branch is current with `dev` (`git pull origin dev`)
- [ ] No `any` types introduced
- [ ] All new response strings use `SYS_MSG` constants, no free-text literals
- [ ] All status codes use `HttpStatus`, no hardcoded numbers
- [ ] New service methods have a one-line JSDoc comment
- [ ] `pnpm lint` and `pnpm build` pass (server)
- [ ] `pnpm --filter client lint` and `pnpm --filter client build` pass (if client changed)
- [ ] Tests pass locally
- [ ] Test evidence screenshot attached above

## Additional Notes

<!-- Anything a reviewer needs to know that isn't obvious from the diff -->
