# Express Boilerplate

A production-ready Express.js boilerplate with PostgreSQL/MySQL support, JWT authentication, role-based access control (RBAC), attribute-based access control (ABAC), and multi-layered rate limiting.

## Features

- **Framework**: Express.js v5
- **Database**: PostgreSQL or MySQL (via Sequelize ORM)
- **Authentication**: JWT with access and refresh tokens
- **Authorization**: RBAC + ABAC with 3 role levels
- **Multi-Tenancy**: Full tenant isolation with identification, scoping, and feature flags
- **Rate Limiting**: Token-based multi-layer rate limiter (in-memory + Redis)
- **Caching**: Redis-based caching for frequently accessed data
- **Message Queue**: Redis-based async email queue for non-blocking operations
- **Distributed Locks**: Redis-based distributed locking to prevent race conditions
- **API Documentation**: Swagger/OpenAPI
- **Logging**: Winston with daily rotate files
- **Security**: Helmet, CORS, HPP, input sanitization
- **Backups**: Automated cron-based backups with zip compression
- **Session Management**: Automatic expired session cleanup with configurable cron schedule
- **File Uploads**: Tenant logo and user avatar upload with delete functionality
- **Audit Logging**: Comprehensive tenant activity tracking
- **Feature Flags**: Per-tenant feature management
- **Tenant Backup & Restore**: Create, download, and restore tenant data backups

## Endpoints

### Documentation

| Endpoint         | Description              | Access |
| ---------------- | ------------------------ | ------ |
| `/docs`          | Swagger UI documentation | Public |
| `/documentation` | HTML documentation       | Public |
| `/standards`     | Coding standards HTML    | Public |

### Health Checks

| Endpoint  | Description           |
| --------- | --------------------- |
| `/`       | API status            |
| `/health` | Database connectivity |
| `/ready`  | Readiness probe       |
| `/live`   | Liveness probe        |
| `/error`  | Test error handling   |

### Internal Endpoints (Development Only)

| Method | Endpoint                    | Description             |
| ------ | --------------------------- | ----------------------- |
| GET    | `/api/v1/migration/up`      | Run database migrations |
| GET    | `/api/v1/migration/seeding` | Seed initial data       |
| GET    | `/api/v1/migration/down`    | Rollback migrations     |
| GET    | `/api/v1/migration/unseed`  | Unseed initial data     |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ or MySQL 8+
- Redis 7+ (for caching, message queue, and distributed locks)
- npm or bun

### Installation

1. Clone the repository:

```bash
git clone https://github.com/zed378/boilerplate-pg-mysql.git
cd boilerplate-pg-mysql
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
DB_NAME=your_database
DB_USER=your_username
DB_PASS=your_password
DB_DIALECT=postgres  # or mysql

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRED=15m
JWT_REFRESH_EXPIRED=7d

# Email (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
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
