Run `git diff HEAD~1 --name-only` to identify all files changed in the last commit. For each changed file, check if it affects any of these docs: CLAUDE.md, backend/CLAUDE.md, frontend/CLAUDE.md, API.md, ARCHITECTURE.md, frontend/README.md. Specifically:

1. If any handler or route files changed, re-read all endpoint handlers and verify API.md has accurate routes, methods, request/response shapes, and auth requirements. Fix any discrepancies.
2. If any new packages, files, or major types were added, update ARCHITECTURE.md's structure section.
3. If build commands, environment variables, or dependencies changed, update the relevant CLAUDE.md.

For each doc you update, run a verification pass: cross-reference every claim against the actual source code. Show me a summary of what you updated and why.
