# CashMate API (Express + MySQL)

REST API for the CashMate personal finance application.

## Requirements

- Node.js 18+
- MySQL 8.x (or use the provided `docker-compose.yml` at the repo root)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    -> fill DB_* values, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
#    -> generate secrets: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Create the database
mysql -u root -p -e "CREATE DATABASE cashmate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. Apply migrations (idempotent, tracked in the `migrations` table)
npm run migrate

# 5. Seed system data (built-in categories, payment methods, optional admin)
npm run seed

# 6. Run
npm run dev        # http://localhost:4000
```

> `npm run seed` creates an admin account only when `ADMIN_EMAIL` and
> `ADMIN_PASSWORD` are set in `server/.env`.

## Scripts

| Command          | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `npm run dev`    | Start API with auto-reload               |
| `npm start`      | Start API (production)                   |
| `npm run migrate`| Apply pending SQL migrations             |
| `npm run seed`   | Seed system categories / payment methods / admin |
| `npm test`       | Run the test suite (55 tests)            |

## API overview

All responses use a consistent envelope:

```json
{ "success": true,  "message": "...", "data": {}, "meta": {} }
{ "success": false, "message": "...", "errors": { "field": "message" } }
```

Authentication uses a short-lived JWT access token (`Authorization: Bearer`)
plus a rotating, hashed refresh token stored in an httpOnly cookie
(path `/api/auth`). Expired sessions are silently refreshed once by the
frontend; when the refresh token also expires the user is logged out
automatically.

### Auth — `/api/auth`
| Method | Path               | Auth | Description |
| ------ | ------------------ | ---- | ----------- |
| POST   | `/register`        | –    | Create account, returns user + access token |
| POST   | `/login`           | –    | Sign in (rate limited) |
| POST   | `/refresh`         | cookie | Rotate session, new access token |
| POST   | `/logout`          | –    | Revoke refresh token |
| POST   | `/forgot-password` | –    | Email reset link (rate limited) |
| POST   | `/reset-password`  | –    | Set new password with token |
| POST   | `/change-password` | ✔    | Change password (revokes other sessions) |
| GET    | `/me`              | ✔    | Current user |
| POST   | `/verify-email`    | –    | Confirm email with token |

### Users — `/api/users`
| Method | Path        | Auth | Description |
| ------ | ----------- | ---- | ----------- |
| PUT    | `/profile`  | ✔    | Update name / phone / currency |
| POST   | `/avatar`   | ✔    | Upload profile picture (JPEG/PNG/WebP, max 2 MB) |
| DELETE | `/account`  | ✔    | Delete account + all data (password required) |

### Core — `/api` (all require auth)
| Method | Path                   | Description |
| ------ | ---------------------- | ----------- |
| GET    | `/dashboard/summary`   | Totals, trends, category breakdown, recent txns, monthly series (supports `preset`, `from`, `to`) |
| GET    | `/transactions`        | Paginated list: `page, limit, search, type, categoryId, paymentMethodId, status, from, to, minAmount, maxAmount, sort, order` |
| GET    | `/transactions/:id`    | Single transaction |
| POST   | `/transactions`        | Create income/expense |
| PATCH/PUT | `/transactions/:id` | Update (owner only) |
| DELETE | `/transactions/:id`    | Delete (owner only) |
| GET    | `/categories`          | System + custom categories |
| POST   | `/categories`          | Create custom category |
| PATCH/PUT | `/categories/:id`   | Update custom category |
| DELETE | `/categories/:id`      | Delete custom (blocked if in use) |
| GET    | `/payment-methods`     | Default + custom methods |
| POST   | `/payment-methods`     | Create custom method |
| PATCH/PUT | `/payment-methods/:id`| Update custom method |
| DELETE | `/payment-methods/:id` | Delete custom (blocked if in use) |
| GET    | `/budgets`             | Budgets for `month`/`year` with computed `spent`, `remaining`, `percentUsed` |
| POST   | `/budgets`             | Create budget (category + period uniqueness enforced) |
| PATCH/PUT | `/budgets/:id`       | Update (owner only) |
| DELETE | `/budgets/:id`         | Delete (owner only) |

### Phase 2 — goals, recurring, bills, notifications (all require auth)
| Method | Path                             | Description |
| ------ | -------------------------------- | ----------- |
| GET    | `/goals`                         | Goals with `percentUsed`, `remaining`, `requiredMonthly`, `daysLeft` |
| POST   | `/goals`                         | Create goal |
| GET/PATCH/DELETE | `/goals/:id`           | Read / update / delete (owner only) |
| POST   | `/goals/:id/contributions`       | Add money (updates progress + milestone notifications) |
| GET    | `/goals/:id/contributions`       | Contribution history |
| DELETE | `/goals/:id/contributions/:cid`  | Remove a contribution (decrements goal) |
| GET    | `/recurring`                     | Schedules (`?status=active\|paused\|completed`) |
| POST   | `/recurring`                     | Create schedule (past start dates clamp to today) |
| PATCH/DELETE | `/recurring/:id`           | Update / pause / resume / delete |
| POST   | `/recurring/:id/run`             | Generate the next transaction immediately |
| GET    | `/bills`                         | Bills with `daysUntilDue` + `openCount/overdueCount/dueSoon/openTotal` meta |
| POST   | `/bills`                         | Create bill (name, amount, due date, repeat, reminder days) |
| PATCH/DELETE | `/bills/:id`                | Update / delete |
| POST   | `/bills/:id/pay`                 | Mark paid; recurring bills roll to the next cycle |
| GET    | `/notifications`                 | Paginated (`?unreadOnly=true`) + `unread` meta |
| GET    | `/notifications/unread-count`    | Bell badge count |
| PATCH  | `/notifications/:id/read`        | Mark one read |
| PATCH  | `/notifications/read-all`        | Mark all read |
| DELETE | `/notifications/:id` \| `/notifications` | Delete one / clear all |
| GET/PUT | `/settings`                     | Budget alert thresholds (default 50/75/90/100) |

## Security

- bcrypt password hashing (cost 12), password policy enforced server-side
- JWT access tokens (15 min) + rotating opaque refresh tokens stored **hashed**
- Backend authorization on every route: queries are always scoped by
  `user_id` from the verified token — cross-user access returns 404
- express-validator on every input; parameterised SQL everywhere (mysql2)
- helmet security headers, CORS allow-list, JSON body limit (100 kb)
- Rate limiting: auth endpoints 10/15 min, password reset 5/15 min
- Generic error messages; internals only logged server-side
- Audit log for login/logout/password changes/record changes/account deletion
- All secrets in `.env` (never committed); `.env.example` holds placeholders only

## Tests

```bash
npm test
```

104 tests across `tests/auth.test.js`, `tests/transactions.test.js`,
`tests/budgets.test.js`, `tests/goals.test.js`, `tests/recurring.test.js`,
`tests/bills.test.js`, `tests/notifications.test.js` covering registration,
login, session refresh, password reset/change, CRUD validation, budget
calculations, goal milestones, recurring generation, bill reminders,
notification deduplication, pagination, audit logging and **cross-user
isolation** (the DB layer is mocked with a programmable in-memory mock; the
tests assert every statement is scoped by the authenticated user's id).

## Database

- Schema: `db/migrations/001_initial_schema.sql` (16 tables, InnoDB/utf8mb4)
- Migration: `002_notification_dedupe.sql` (idempotent alert deduplication)
- Migrations are tracked in the `migrations` table and applied once
- Deleting a user cascades to every financial record (no orphans);
  audit logs are preserved with `user_id` set to NULL
- Multi-table operations (password reset, account deletion, contributions)
  run inside DB transactions

## Background jobs

On boot (and hourly thereafter) the server runs:

- **Recurring processor** - generates transactions for due schedules,
  advances `next_run_date`, completes rules past their end date, notifies
- **Bill processor** - marks unpaid bills overdue and sends deduplicated
  reminders `reminder_days_before` ahead of each due date
