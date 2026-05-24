# Production Hardening Report

Date: 2026-05-24

## Completed In This Pass

- Removed unmounted/dead backend route families for legacy attendance, correction, weather, work, synchronization, and payroll-corruption experiments.
- Removed the unused services and middleware those dead routes depended on.
- Replaced backend startup and database query debug noise with sanitized logging.
- Added production-safe global error responses and database-backed `/api/health` plus `/api/ready`.
- Centralized backend CORS/runtime config in `config/env.js`.
- Centralized mobile API/Supabase runtime config in `Mobile/fieldsync-mobile/config/env.js`.
- Centralized web API/Supabase runtime config in `Frontend/fieldsync-frontend/src/config/env.js`.
- Removed hardcoded Render backend URLs from mobile API and payment handler code.
- Removed hardcoded Supabase URL/anon key from mobile and web source.
- Fixed the mobile History loading loop and converted its remaining `className` usage to `StyleSheet`.
- Added root developer checks for backend syntax, backend tests, and mobile lint.
- Added Supabase hardening migration for tracking, payroll exports, payslips, shifts, schedules, and holidays.

## Production Blockers

- Web dashboard still has extensive Tailwind/className usage. Fully removing it requires a deliberate web UI conversion project, not a safe hardening patch.
- Frontend still performs direct Supabase business-table writes in `src/services/api.js`; these must move behind backend endpoints before strict RLS is applied in production.
- Supabase hardening migration revokes direct writes for several key tables. Deploy only after mobile/web write flows are verified against backend APIs in the target environment.
- Environment variables must be configured before deploy:
  - Backend: `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`, Stripe/SendGrid secrets as needed.
  - Mobile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  - Web: `REACT_APP_API_URL`, `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`.

## Medium-Risk Issues

- Several backend route handlers still have route-local validation and inconsistent response shapes.
- Some web auth/session logic still auto-creates user rows client-side.
- React web build is not yet part of the default root `check` command because it is slower and may surface UI-era warnings outside this hardening scope.
- Existing mobile lint warnings remain in `history.js`-adjacent hook usage in unrelated files: `app/index.js`.
- Legacy docs still reference deleted prototype files; docs should be archived or rewritten once production architecture is finalized.

## Recommended Next Milestones

1. Migrate remaining web direct Supabase writes to backend APIs.
2. Apply and test Supabase hardening migrations in staging.
3. Add backend request validation middleware and shared response helpers route-by-route.
4. Add API integration tests for auth scoping, tracking, payslips, schedules, and shifts.
5. Decide whether the web dashboard keeps Tailwind or schedule a dedicated StyleSheet/CSS-module conversion.
6. Add Render deployment manifest or documented build/start commands once final service names and env vars are confirmed.
