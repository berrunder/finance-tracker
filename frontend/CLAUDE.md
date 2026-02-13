# Frontend CLAUDE.md

## Conventions

- `use-auth.ts` uses `createElement` instead of JSX intentionally — keeping the file as `.ts` (not `.tsx`) ensures React Fast Refresh works, since Fast Refresh requires files to only export components. The file exports both `AuthProvider` (component) and `useAuth` (hook), so using `.tsx` would trigger the `react-refresh/only-export-components` lint error.
