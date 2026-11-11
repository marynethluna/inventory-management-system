# Inventory Management System with Access Control

A React, Express and MongoDB inventory application for school resources and computer-lab equipment. It includes role-based access, stock transactions, borrowing and returns, low-stock alerts, reports, theme preferences, account management and audit logs.

The existing client/server folder layout and application routes are retained. The interface uses a warm orange-and-charcoal palette, responsive layout, collapsible navigation, accessible transaction filters, and report-specific print styling.

## Roles

| Role | Access |
| --- | --- |
| **Administrator** | Manage accounts and roles, categories, inventory, stock adjustments, reports, settings and activity logs. |
| **Inventory Staff** | Create and edit inventory, record stock movements and borrowing/returns, review transaction history and receive low-stock alerts. |
| **Viewer** | Read-only dashboard, inventory, categories and reports. Write requests are rejected by the API, not just hidden in the interface. |

Self-signup always creates a Viewer account. It never accepts a role from the client. There are no seeded demo accounts or frontend demo credentials.

## Features

- **Dashboard:** key stock statistics, low-stock alerts, recent transactions, movement/category charts; select among five chart types, remembered for the browser session.
- **Inventory:** search, filters, sorting, pagination, categories, archive/restore and item details. Stock quantity is not editable on the item form; an opening balance creates a Stock In record.
- **Transactions:** Stock In, Stock Out and Administrator-only Adjustment flows; validated quantities, summary filters, search and history. Stock and its ledger record commit together in a MongoDB transaction.
- **Borrowing:** borrowing records deduct stock and create a transaction; returns restore stock and record a matching ledger entry, all atomically.
- **Reports:** report types and filters, CSV/PDF export and print-only report layout. Reports are readable by all roles.
- **Accounts:** Administrator-only account and role management, with self/last-active-administrator safeguards and session invalidation after security changes.
- **Settings:** profile/password, light/dark theme, and Administrator inventory defaults, configured units and category management.
- **Audit and alerts:** important account, authentication, inventory, category, stock and borrowing actions are logged. Low-stock alerts are available to all roles; overdue-borrow details are restricted to operational roles.
- **Authentication:** password hashing, secure HTTP-only cookies, Viewer-only signup, hashed one-time expiring reset tokens, and development reset links surfaced in the UI without SMTP.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- MongoDB for persistent deployments. The built-in development database uses an in-process single-node replica set.

## Quick start

From the project root:

```sh
npm run setup
cp server/.env.example server/.env
```

Edit `server/.env` before starting. Generate a private JWT secret, and configure a first Administrator before the first launch:

```env
NODE_ENV=development
PORT=4000
JWT_SECRET=<private random value; generate with openssl rand -base64 48>
JWT_EXPIRES_IN=7d
COOKIE_SECURE=false
CLIENT_ORIGIN=http://localhost:5173
CLIENT_URL=http://localhost:5173
INITIAL_ADMIN_NAME=Inventory Administrator
INITIAL_ADMIN_EMAIL=admin@your-school.example
INITIAL_ADMIN_PASSWORD=<private password of at least 8 characters>
```

Replace the example administrator values with private, unique values and do not commit `.env`. The bootstrap account is created only when the user collection is empty. No preset username or password exists. If no bootstrap account is configured, users can self-register as Viewers, but only an Administrator can manage privileged functions.

Start the API and client in separate terminals:

```sh
npm run dev:server
npm run dev:client
```

Open `http://localhost:5173`. The Vite server proxies `/api` to port 4000. To serve the production build from Express instead:

```sh
npm run build
npm start
```

The API is available at `http://localhost:4000/api`. `/api/health` is a minimal public liveness endpoint. Other application data routes require authentication and role permissions.

## Password-reset email

When `SMTP_HOST` is not configured in development, password-reset requests keep a generic confirmation message and show a one-time reset link in the UI for a registered account (the link is also printed to the server console). No SMTP service is needed for local preview testing. For email delivery, set `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM`. Set `CLIENT_URL` to the client’s exact public origin when deployed separately. Use HTTPS and `COOKIE_SECURE=true` in production.

## Database and atomic stock changes

If `MONGODB_URI` is unset, the server launches an in-process MongoDB replica set for local development; its data is temporary and disappears when the process stops. For persistent use, set `MONGODB_URI` to a MongoDB **replica-set or sharded-cluster** URI. Stock changes, their transaction ledger entries, and borrowing state use multi-document transactions and fail closed if transactions are unavailable; standalone MongoDB deployments are not supported for these operations.

Seed initialization creates realistic computer-lab categories, items and recorded stock history without creating user accounts (except for the optional bootstrap Administrator). To reseed inventory:

```sh
npm run seed
# To clear and recreate inventory data while preserving accounts:
cd server && FORCE=1 npm run seed
```

## API outline

All endpoints are under `/api`. Authentication uses the `ims_token` HTTP-only cookie; bearer-token and browser-storage fallbacks are not accepted.

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password` | Public, rate-limited where appropriate |
| POST | `/auth/logout`, `/auth/change-password`; PATCH `/auth/profile` | Authenticated |
| GET | `/auth/me` | Authenticated |
| GET/POST/PATCH/DELETE | `/items` and item routes | Inventory permissions; writes limited to Administrator/Inventory Staff, archive/restore Administrator-only |
| GET/POST | `/transactions` | Administrator/Inventory Staff; stock adjustment Administrator-only |
| GET/POST | `/borrows`; POST `/borrows/:id/return` | Administrator/Inventory Staff |
| GET/POST/PATCH/DELETE | `/categories` | Read all roles; management Administrator-only |
| GET | `/reports` | All authenticated roles |
| GET/POST/PATCH | `/users` and user routes | Administrator-only |
| GET | `/activity-logs` | Administrator-only |
| GET/PATCH | `/settings` | Read all roles; inventory defaults/units Administrator-only |
| GET | `/dashboard`, `/dashboard/notifications` | All authenticated roles; overdue details are role-filtered |
| GET | `/health` | Public minimal liveness response |

The server permission matrix is in `server/src/utils/permissions.js`; the client mirrors it only for navigation and presentation. Express independently enforces every protected action.

## Security notes

- Passwords are hashed with bcrypt; reset tokens are random, hashed in storage, one-time and expire after 20 minutes.
- JWT sessions are stored in HTTP-only, `SameSite=Strict` cookies, with `Secure` enabled in production. Deactivation, role changes, password changes and logout invalidate sessions.
- A production server refuses to start with a missing, short or placeholder JWT secret. Set `CLIENT_ORIGIN` to the exact allowed browser origin(s); unlisted Origin headers are rejected.
- Helmet headers, JSON size limits, global and authentication-specific rate limits, recursive NoSQL-operator sanitization, field validation and explicit update whitelists protect the API.
- Stock cannot be negative. All runtime quantity changes and corresponding ledger/borrow records commit in database transactions.
- Do not expose development reset links, bootstrap credentials, SMTP credentials or `.env` files in production logs or source control.

## Project structure

```text
client/  React/Vite SPA, routes, role-aware layout, pages, styles and API client
server/  Express API, auth/security middleware, Mongoose models, routes and seed data
```
