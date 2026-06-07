# Callibrator Backend

A production-ready Express.js boilerplate with PostgreSQL support, JWT authentication, role-based access control (RBAC), attribute-based access control (ABAC), dynamic table permissions, and multi-layered rate limiting. Designed for multi-tenant SaaS applications.

## Features

- **Framework**: Express.js v5
- **Database**: PostgreSQL 14+ (via Sequelize ORM)
- **Authentication**: JWT with access and refresh tokens
- **Authorization**: RBAC + ABAC with dynamic table permissions
- **Multi-Tenancy**: Full tenant isolation with identification, scoping, and feature flags
- **Rate Limiting**: Token-based multi-layer rate limiter (in-memory + Redis)
- **Caching**: Redis-based caching for frequently accessed data
- **Email Queue**: Redis-based async email processing for non-blocking operations
- **Distributed Locks**: Redis-based distributed locking to prevent race conditions
- **Model Discovery**: Automatic database model detection and registration
- **API Documentation**: Swagger/OpenAPI
- **Logging**: Winston with daily rotating log files
- **Security**: Helmet, CORS, HPP, input sanitization
- **Backups**: Automated cron-based backups with zip compression
- **Session Management**: Automatic expired session cleanup with configurable cron schedule
- **File Uploads**: Tenant logo and user avatar upload with delete functionality
- **Audit Logging**: Comprehensive tenant activity tracking
- **Feature Flags**: Per-tenant feature management
- **Tenant Backup & Restore**: Create, download, and restore tenant data backups

## API Response Format

All API responses follow a standardized format:

### Success Response

```json
{
  "success": true,
  "status": 200,
  "message": "Operation successful",
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "customCounts": { ... }
  }
}
```

### Error Response

```json
{
  "success": false,
  "status": 404,
  "message": "Resource not found",
  "data": null
}
```

## API Endpoints

### Documentation

| Endpoint         | Description              | Access |
| ---------------- | ------------------------ | ------ |
| `/docs`          | Swagger UI documentation | Public |
| `/documentation` | HTML documentation       | Public |

### Health Checks

| Endpoint  | Description           |
| --------- | --------------------- |
| `/`       | API status            |
| `/health` | Database connectivity |
| `/ready`  | Readiness probe       |
| `/live`   | Liveness probe        |

### Authentication

| Method | Endpoint                  | Access  |
| ------ | ------------------------- | ------- |
| POST   | `/api/v1/auth/register`   | Public  |
| GET    | `/api/v1/auth/activation` | Public  |
| POST   | `/api/v1/auth/login`      | Public  |
| POST   | `/api/v1/auth/send-otp`   | Public  |
| POST   | `/api/v1/auth/logout`     | Private |

### Users

| Method | Endpoint               | Access  | Permission  |
| ------ | ---------------------- | ------- | ----------- |
| GET    | `/api/v1/users/all`    | Private | User:read   |
| POST   | `/api/v1/users/detail` | Private | User:read   |
| POST   | `/api/v1/users/create` | Private | User:create |
| PUT    | `/api/v1/users/update` | Private | User:update |
| DELETE | `/api/v1/users/delete` | Private | User:delete |

### Tenants

| Method | Endpoint                 | Access  | Permission    |
| ------ | ------------------------ | ------- | ------------- |
| GET    | `/api/v1/tenants/all`    | Private | Tenant:read   |
| POST   | `/api/v1/tenants/detail` | Private | Tenant:read   |
| POST   | `/api/v1/tenants/create` | Private | Tenant:create |
| PUT    | `/api/v1/tenants/update` | Private | Tenant:update |
| DELETE | `/api/v1/tenants/delete` | Private | Tenant:delete |

### Roles & Permissions

| Method | Endpoint                     | Access  | Permission        |
| ------ | ---------------------------- | ------- | ----------------- |
| GET    | `/api/v1/roles`              | Private | Role:read         |
| POST   | `/api/v1/roles/create`       | Private | Role:create       |
| POST   | `/api/v1/roles/update`       | Private | Role:update       |
| DELETE | `/api/v1/roles/delete`       | Private | Role:delete       |
| POST   | `/api/v1/permissions/grant`  | Private | Permission:grant  |
| POST   | `/api/v1/permissions/revoke` | Private | Permission:revoke |

### Table Permissions (Dynamic)

| Method | Endpoint                                            | Access  |
| ------ | --------------------------------------------------- | ------- |
| GET    | `/api/v1/table-permissions/models`                  | Private |
| POST   | `/api/v1/table-permissions/models`                  | Private |
| POST   | `/api/v1/table-permissions/permissions/upsert`      | Private |
| POST   | `/api/v1/table-permissions/role-permissions/grant`  | Private |
| POST   | `/api/v1/table-permissions/role-permissions/revoke` | Private |
| POST   | `/api/v1/table-permissions/check`                   | Private |

### Model Discovery

| Method | Endpoint                           | Access  |
| ------ | ---------------------------------- | ------- |
| GET    | `/api/v1/model-discovery/models`   | Private |
| POST   | `/api/v1/model-discovery/discover` | Private |

### Tenant Backup

| Method | Endpoint                             | Access  |
| ------ | ------------------------------------ | ------- |
| POST   | `/api/v1/tenant-backup/create`       | Private |
| GET    | `/api/v1/tenant-backup`              | Private |
| GET    | `/api/v1/tenant-backup/download/:id` | Private |
| POST   | `/api/v1/tenant-backup/restore/:id`  | Private |

### Migration (Internal/Development Only)

| Method | Endpoint                    | Description             |
| ------ | --------------------------- | ----------------------- |
| GET    | `/api/v1/migration/up`      | Run database migrations |
| GET    | `/api/v1/migration/seeding` | Seed initial data       |

## Project Structure

```
callibrator-be/
├── src/
│   ├── config/              # Database & app configuration
│   ├── constants/           # Centralized constants
│   ├── controllers/         # Request handlers
│   │   ├── auth.controller.js
│   │   ├── menuGroup.controller.js
│   │   ├── migration.controller.js
│   │   ├── modelDiscovery.controller.js
│   │   ├── permission.controller.js
│   │   ├── roles.controller.js
│   │   ├── tablePermission.controller.js
│   │   ├── tenant.controller.js
│   │   ├── tenantBackup.controller.js
│   │   └── user.controller.js
│   ├── docs/                # Swagger configuration
│   ├── middlewares/         # Express middlewares
│   │   ├── abac.js
│   │   ├── auth.js
│   │   ├── dynamicAccess.js
│   │   ├── tenantContext.js
│   │   ├── tenantScope.js
│   │   └── ...
│   ├── models/              # Sequelize models
│   ├── routes/              # API route definitions
│   ├── services/            # Business logic
│   │   ├── auth.service.js
│   │   ├── emailQueue.service.js
│   │   ├── modelDiscovery.service.js
│   │   ├── tablePermission.service.js
│   │   └── ...
│   ├── templates/           # Email HTML templates
│   ├── tests/               # Jest tests
│   ├── utils/               # Utility functions
│   └── validators/          # Joi validation schemas
├── docs/                    # Documentation files
├── uploads/                 # Uploaded files
├── Dockerfile
├── docker-compose.yaml
├── package.json
└── index.js
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+ (for caching, message queue, and distributed locks)
- npm or bun

### Installation

1. Clone the repository:

```bash
git clone https://github.com/zed378/callibrator-be.git
cd callibrator-be
```

2. Install dependencies:

```bash
npm install
```

3. Copy and configure environment variables:

```bash
cp local.env .env
```

4. Update `.env` with your configuration:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=callibrator
DB_USER=callibrator
DB_PASS=your_password
DB_DIALECT=postgres

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

5. Start the development server:

```bash
npm run dev
```

6. Start the production server:

```bash
npm start
```

## License

MIT
