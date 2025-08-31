# Chore Chart (PWA + Lit + Supabase)

First draft of a family chore chart application.

## Tech
- Frontend: Lit Web Components (no React), Vite.
- Backend: Supabase (Postgres, Auth, Realtime).
- Auth: Email (password or OTP), optional Passkeys (WebAuthn) if enabled in Supabase project.
- PWA: Manifest + service worker.

## Getting Started

1. Create a Supabase project and enable the following:
   - Auth: Email (password and/or magic link). Optionally enable Passkeys/WebAuthn.
   - Realtime: Postgres Changes enabled for schema `public`.

2. Apply the database schema and policies:

   - In the Supabase SQL editor, run the migration file:

   ```sql
   -- supabase/migrations/0001_init.sql
   -- Paste the contents of that file here and run.
   ```

3. Environment variables

   Create `.env` in project root:

   ```bash
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Install and run

   ```bash
   npm install
   npm run dev
   ```

5. PWA
- Vite dev will serve the app; service worker will register in production builds. The included service worker is simple network-first with static caching.

## Roles & RLS expectations
- Create a family as the first logged-in user. This sets you as `parent` by default (you can edit your profile role in DB as needed).
- Other users sign in (creating their `users` row on first visit). A parent can set their `family_id` and `role` via DB or by extending the UI later.
- Parents can assign chores and approve. Children can mark chores as done. Everyone only sees one family via RLS.

## Realtime
- Components subscribe to `chores`, `approvals`, and `streaks` updates via Supabase Realtime with filters on `family_id`.

## Notes
- Passkeys: The UI checks for `supabase.auth.webauthn`. If your project supports it, the buttons will call `register()` and `authenticate()`. If not, the buttons are hidden.
- CSS kept intentionally minimal and scoped to components.
- Future work: invitations, notifications, better role management, recurring chore generation, mobile-friendly polish.