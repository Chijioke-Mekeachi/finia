# FinTrack Pro API Specification

This document outlines the optional FastAPI backend endpoints. Most app data (profiles, settings, transactions, goals) is accessed directly from Supabase Postgres via `@supabase/supabase-js`.

All backend endpoints expect `Authorization: Bearer <token>` where `<token>` is the **Supabase access token** (JWT) from `supabase.auth.getSession()`.

## Authentication
Authentication is handled by **Supabase Auth** (email/password). The backend does not provide `/auth/*` endpoints.

## Transactions (The Ledger)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/transactions` | Fetch user transactions (supports `?limit=` and `?offset=`). |
| POST | `/api/transactions` | Record a new ledger entry. Validates category and amount. |
| DELETE | `/api/transactions/:id` | Soft or hard delete a transaction based on audit requirements. |

## Business Settings
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/settings` | Retrieve company name, currency, and fiscal settings. |
| POST | `/api/settings` | Upsert business profile (updates existing or creates new). |

## Company Goals
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/goals` | List goals (supports `?limit=`, `?offset=`, `?include_archived=`). |
| POST | `/api/goals` | Create a new goal (title, target, progress fields). |
| PATCH | `/api/goals/:id` | Update a goal (including progress/current value). |
| DELETE | `/api/goals/:id` | Delete a goal. |

## Subscription & Billing
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/subscription` | Check current tier and feature flags. |
| PATCH | `/api/subscription` | Upgrade/Downgrade plan. Usually triggers a Stripe webhook. |

### Billing (Paystack)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/billing/paystack/initialize` | Initialize a Paystack payment for a plan upgrade and return `authorization_url`. |
| GET | `/api/billing/paystack/verify?reference=...` | Verify a Paystack transaction reference and apply the plan on success. |

## Intelligence Proxy
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/ai/analyze` | (Optional) Proxies Gemini requests to keep API keys server-side. |
| POST | `/api/ai/vision` | (Optional) Proxies Gemini vision requests (receipt scanning) to keep API keys server-side. |
| POST | `/api/ai/tts` | (Optional) Proxies Gemini text-to-speech and returns WAV (base64). |

## Auditing
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/audit/compare-excel` | Upload 2 Excel files and return cell-by-cell differences as JSON. |
| POST | `/api/audit/compare-excel/v2` | Returns `{ scan_id, diffs }` where each diff also includes the full changed row for File 1 and File 2 (for readability). |
| GET | `/api/audit/scans` | List previous scans for the current user. |
| GET | `/api/audit/scans/:id` | Fetch a scan (metadata + diffs) for the current user. |

Notes:
- Row context is capped by `AUDIT_ROW_CONTEXT_MAX_COLS` (default `200`) and `AUDIT_ROW_CONTEXT_MAX_DIFFS` (default `1000`).

### AI usage limits (rolling 24h)
The backend enforces per-user quotas for **chat-like** AI calls (`/api/ai/analyze`, `/api/ai/vision`) based on `profiles.subscription_plan_id`:

- `basic`: 10 calls / 24h
- `standard`: 30 calls / 24h
- `premium`: 80 calls / 24h

Back-compat plan ids:
- `strategic` → treated as `standard`
- `executive` → treated as `premium`

When exceeded, the API returns `429 Too Many Requests` with a `Retry-After` header.

## Administration (Dev Only)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/admin/users` | List all users and summary info. Requires `X-Admin-Key`. |
| GET | `/admin/users/:id` | Fetch a user with settings + latest transactions. Requires `X-Admin-Key`. |
| GET | `/admin/transactions` | List all transactions across all users. Supports filters (`from_date`, `to_date`, `type`, `q`) and CSV export (`format=csv`). Requires `X-Admin-Key`. |
