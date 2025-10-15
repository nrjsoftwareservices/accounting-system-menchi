Accounting System (Monorepo)

Contents
- backend: Laravel 12 API (Sanctum, Spatie Roles)
- frontend-web: Next.js 15 app (Tailwind)
- docker-compose.yml: MySQL, Redis, PHP-FPM, Nginx

Quickstart (Local)
- PHP 8.3 + Composer installed
- Node 18+ and npm

Backend
- cd backend
- composer install
- cp .env.example .env
- php artisan key:generate
- php artisan migrate --seed
- php artisan serve (http://127.0.0.1:8000)

Docker (Backend)
- docker compose up -d --build
- cp backend/.env.docker backend/.env
- docker compose exec backend-php php artisan key:generate
- docker compose exec backend-php php artisan migrate --seed
- API base: http://localhost:8080/api/v1

Docker (Full Stack)
- docker compose up -d --build
- First-time backend setup (inside containers):
  - docker compose exec backend-php composer install
  - docker compose exec backend-php cp .env.docker .env
  - docker compose exec backend-php php artisan key:generate
  - docker compose exec backend-php php artisan migrate --seed
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api/v1
- The frontend talks to the API via NEXT_PUBLIC_API_BASE (set in docker-compose).

Frontend (Web)
- cd frontend-web
- npm install
- NEXT_PUBLIC_API_BASE=http://localhost:8080/api/v1 npm run dev (http://localhost:3000)

MVP API Endpoints
- POST /api/v1/auth/register { name, email, password, password_confirmation, organization: { name, code, default_currency? } }
- POST /api/v1/auth/login { email, password }
- GET /api/v1/organizations (clerk+)
- POST /api/v1/organizations (admin)
- GET /api/v1/accounts (clerk+, X-Org-Id or organization_id)
- POST /api/v1/accounts (accountant+, X-Org-Id or organization_id)
- GET /api/v1/journals (manager+, X-Org-Id or organization_id)
- POST /api/v1/journals (accountant+, lines[] debits=credits)
- GET /api/v1/reports/trial-balance?as_of=YYYY-MM-DD&organization_id=ID (manager+)
- GET/POST /api/v1/customers (clerk+ / accountant+)
- GET/POST /api/v1/suppliers (clerk+ / accountant+)
- GET/POST/PUT/DELETE /api/v1/customers (edit/delete: accountant+)
- GET/POST/PUT/DELETE /api/v1/suppliers (edit/delete: accountant+)
- GET/POST/PUT/DELETE /api/v1/ar/invoices (manager+ / accountant+), POST /api/v1/ar/invoices/{id}/post (accountant+) — edit/delete only when draft
- GET/POST/PUT/DELETE /api/v1/ap/bills (manager+ / accountant+), POST /api/v1/ap/bills/{id}/post (accountant+) — edit/delete only when draft
- POST /api/v1/imports/accounts (accountant+) CSV: code,name,type,parent_code
- POST /api/v1/imports/journals (accountant+) CSV: entry_date,reference,account_code,debit,credit,description

Org Scoping
- Provide org via header X-Org-Id or query organization_id

Roles
- Hierarchy: auditor < clerk < manager < accountant < admin
- Enforced via middleware `org.role:<minRole>` using `user_organizations.role`

Tests
- cd backend && php artisan test

Frontend (Web) Pages
- Sidebar layout with breadcrumbs
- Customers/Suppliers: list, search, add, edit, delete
- AR Invoices/AP Bills: filters (status, date, party, search), create with line items, edit/delete (draft only), post to ledger, totals
- Imports: CSV upload for accounts and journals
