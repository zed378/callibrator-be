# Callibrator Backend

A production-ready Express.js API with PostgreSQL, JWT authentication, RBAC, multi-tenancy, and Redis-based caching/queuing. Built for scalable SaaS applications.

## Features

| Category | Feature |
|---|---|
| **Framework** | Express.js v5, Node.js 18+ |
| **Database** | PostgreSQL 14+ via Sequelize ORM |
| **Auth** | JWT access (15m) + refresh (7d) tokens |
| **Authorization** | RBAC — Super Admin, Tenant Admin, User |
| **Multi-Tenancy** | Full isolation with feature flags per tenant |
| **Caching** | Redis — user/tenant lookups, session cache |
| **Rate Limiting** | Token bucket (in-memory default + Redis fallback) |
| **Queue** | RabbitMQ — async email with DLQ, retry, exponential backoff |
| **Distributed Locks** | Redis Lua scripts — race condition prevention |
| **Security** | Helmet, CORS, HPP, XSS sanitizer, input validation (Joi) |
| **Logging** | Winston with daily rotating file logs |
| **API Docs** | Swagger/OpenAPI (auto-generated) |
| **Backups** | Per-tenant PostgreSQL dump with restore |
| **File Uploads** | Multer — tenant logos, user avatars |
| **Audit** | Tenant activity tracking via `TenantAuditLog` |
| **Sessions** | Multi-device session management with auto-cleanup cron |

## API Response Format

All endpoints return JSON:

**Success:**
```json
{ "success": true, "status": 200, "message": "Operation successful", "data": { ... } }
```

**Error:**
```json
{ "success": false, "status": 404, "message": "Resource not found" }
```

**Paginated:**
```json
{ "success": true, "status": 200, "message": "Success", "data": [...], "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 } }
```

## API Endpoints

### Authentication

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/v1/auth/register` | Public |
| GET | `/api/v1/auth/activation?token=xxx` | Public |
| POST | `/api/v1/auth/login` | Public |
| POST | `/api/v1/auth/send-otp` | Public |
| POST | `/api/v1/auth/reset-password` | Public |
| POST | `/api/v1/auth/logout` | Private |
| POST | `/api/v1/auth/logout-all` | Private |
| GET | `/api/v1/auth/verify` | Private |
| POST | `/api/v1/auth/just-update-password` | Private |
| GET | `/api/v1/auth/pass-is-valid` | Private |

### Users

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/v1/users/all` | User:read |
| POST | `/api/v1/users/detail` | User:read |
| POST | `/api/v1/users/create` | User:create |
| PUT | `/api/v1/users/edit` | User:update |
| DELETE | `/api/v1/users/delete` | User:delete |
| POST | `/api/v1/users/role-update` | User:role-update |
| GET | `/api/v1/users/username-check` | User:username-check |
| PUT | `/api/v1/users/:id/avatar` | User:avatar |

### Roles

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/v1/roles` | Role:read |
| GET | `/api/v1/roles/all` | Role:read |
| POST | `/api/v1/roles/detail` | Role:read |
| POST | `/api/v1/roles/create` | Role:create |
| PATCH | `/api/v1/roles/edit` | Role:update |
| DELETE | `/api/v1/roles/delete` | Role:delete |
| GET | `/api/v1/roles/:id/users` | Role:users |

### Tenants

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/v1/tenants/all` | Tenant:read |
| POST | `/api/v1/tenants/detail` | Tenant:read |
| POST | `/api/v1/tenants/create` | Tenant:create |
| PATCH | `/api/v1/tenants/edit` | Tenant:update |
| DELETE | `/api/v1/tenants/delete` | Tenant:delete |
| POST | `/api/v1/tenants/:id/upload-logo` | - |
| GET | `/api/v1/tenants/:id/features` | Tenant:feature |
| PATCH | `/api/v1/tenants/:id/features` | Tenant:feature-update |
| GET | `/api/v1/tenants/:id/backups` | Tenant:backup |
| GET | `/api/v1/tenants/:id/backups/:id` | Tenant:backup |
| GET | `/api/v1/tenants/:id/backups/:id/download` | Tenant:backup |
| POST | `/api/v1/tenants/:id/backups/:id/restore` | Tenant:backup |
| GET | `/api/v1/tenants/:id/backups/stats` | Tenant:backup |

### Sessions

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/v1/sessions/stats` | Session:read |
| GET | `/api/v1/sessions` | Session:read |
| GET | `/api/v1/sessions/:id` | Session:read |
| POST | `/api/v1/sessions/:id/revoke` | Session:revoke |
| POST | `/api/v1/sessions/user/:userId/revoke-all` | Session:revoke |

### Health Checks

| Endpoint | Description |
|---|---|
| `/` | API status |
| `/health` | Database connectivity |
| `/ready` | Readiness probe |
| `/live` | Liveness probe |

### Documentation

| Endpoint | Description |
|---|---|
| `/docs` | Swagger UI |
| `/documentation` | HTML documentation |

### Internal (Development Only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/migration/up` | Run migrations |
| GET | `/api/v1/migration/seeding` | Seed data |
| Console | `node src/scripts/reset-db.js` | Drop + recreate + seed |

## Project Structure

```
callibrator-be/
├── src/
│   ├── config/          # Database & app config
│   ├── constants/       # Centralized constants
│   ├── controllers/     # Request handlers
│   ├── docs/            # Swagger configuration
│   ├── middlewares/     # Express middlewares
│   ├── models/          # Sequelize models
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic
│   ├── templates/       # Email HTML templates
│   ├── tests/           # Jest tests
│   ├── utils/           # Utility functions
│   └── validators/      # Joi validation schemas
├── docs/                # Markdown documentation
├── uploads/             # Uploaded files
├── Dockerfile
├── docker-compose.yaml
├── package.json
└── index.js
```

## Getting Started

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- **Redis** 7+
- **RabbitMQ** 3.13+ (for email queue)

### Quick Start

```bash
git clone https://github.com/zed378/callibrator-be.git
cd callibrator-be
npm install
cp local.env .env
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `callibrator` |
| `DB_USER` | Database user | `callibrator` |
| `DB_PASS` | Database password | - |
| `DB_DIALECT` | PostgreSQL/MySQL | `postgres` |
| `DB_SSL` | Enable SSL | `false` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Access token secret | **required** |
| `JWT_REFRESH_SECRET` | Refresh token secret | **required** |

### Docker Compose

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  rabbitmq:
    image: rabbitmq:3.13-management
    ports:
      - "5672:5672"
      - "15672:15672"
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server (nodemon) |
| `npm start` | Production server |
| `npm test` | Jest test suite |
| `npm run swagger:generate` | Generate swagger.json |
| `npm run build` | Package executable (pkg) |

## Authentication Flow

1. Login → receive access token (15m) + refresh token (7d)
2. Every request sends `Authorization: Bearer <token>`
3. Middleware validates JWT, fetches user with role, checks status
4. RBAC middleware checks role level (Super Admin → Tenant Admin → User)
5. Tenant scope middleware filters queries by `tenant_id`

## License

MIT
