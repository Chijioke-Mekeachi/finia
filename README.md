cle<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1hyjP2QrYcd4W-kxAiL4MH14tkNbadXr2

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure Supabase in `frontend/.env.local`:
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...`
3. (Optional) Enable the backend (AI / Excel Auditing / Paystack):
   - `VITE_API_URL=http://localhost:3001`
   - Optional Paystack checkout:
     - `VITE_PAYSTACK_ENABLED=1`
     - `VITE_PAYSTACK_PUBLIC_KEY=pk_live_...` (recommended for redirect flow)
4. Run the app:
   `npm run dev`

### Admin Route (Dev Only)

The admin console is available at `/admin` during development (e.g. `http://localhost:3000/admin`).
It requires `ADMIN_API_KEY` in `backend/.env`.

## Backend (FastAPI)

The backend lives in `backend/` and is optional. It provides AI proxy endpoints, Excel auditing, and Paystack billing.

**Prerequisites:** Python 3.10+

1. Create a virtual environment and install dependencies:
   `python -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt`
2. Set secrets in `backend/.env`:
   Set `GEMINI_API_KEY=...` if you want AI features (Advisor/Reports/Receipt Scanner).
   Set `ADMIN_API_KEY=...` if you want to use the dev-only Admin Console.
   Set `SUPABASE_URL=...`, `SUPABASE_ANON_KEY=...`, `SUPABASE_SERVICE_ROLE_KEY=...`, `SUPABASE_JWT_SECRET=...` from your Supabase project.
3. Run the API:
   `python -m uvicorn backend.main:app --reload --port 3001`

If you see `ModuleNotFoundError: No module named 'backend'`, make sure you run the command from the repo root (`/home/parrotos/Desktop/fin`) and not inside `backend/`.

### Supabase (DB + Auth)

1. Run the SQL in `supabase/fintrack_schema.sql` in the Supabase SQL Editor.
2. Configure `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `frontend/.env.local`.

## Company Goals

FinTrack includes a **Goals** screen where users can:
- Create company goals with a target, unit, optional due date, and description
- Update the current value to track progress (progress bar + %)
- Save changes (persisted via `/api/goals` when the FastAPI backend is configured, otherwise stored locally)

The **AI Advisor** automatically receives your current (non-archived) goals + progress as part of its context.
# finia
