# Development Guide

## Prerequisites

- Node.js 20.10.0+ (use `nvm use`)
- Docker and Docker Compose
- PostgreSQL 16+ (for local development)
- Redis 7+ (for local development)
- Git

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/PepitoBailao/PepitoStream.git
cd PepitoStream
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Setup environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start services with Docker

```bash
docker-compose up -d
```

This starts:
- PostgreSQL database
- Redis cache
- Backend API
- Frontend (optional)
- Nginx reverse proxy

### 5. Run migrations

```bash
npx prisma migrate deploy
```

### 6. Seed database (optional)

```bash
npx prisma db seed
```

### 7. Start development server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## Development Workflow

### Creating a new feature

1. Create feature branch: `git checkout -b feat/my-feature`
2. Make changes
3. Write tests: `npm run test`
4. Run linter: `npm run lint`
5. Commit: `git commit -m "feat: description"`
6. Push: `git push origin feat/my-feature`
7. Create Pull Request

### Running tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- searchService.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Building

```bash
npm run build
```

Output is in the `dist/` directory.

### Docker commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f backend

# Run migrations in Docker
docker-compose exec backend npx prisma migrate deploy

# Open database shell
docker-compose exec postgres psql -U pepito -d pepitostream
```

## Project Structure

```
PepitoStream/
├── src/
│   ├── server.ts           # Express app setup
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Express middleware
│   ├── scrapers/           # Content scrapers
│   ├── workers/            # Background jobs
│   ├── utils/              # Utilities
│   └── types/              # TypeScript types
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
├── tests/
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
├── .github/workflows/      # CI/CD pipelines
├── docker-compose.yml      # Docker services
├── Dockerfile              # Docker image
├── nginx.conf              # Nginx config
├── openapi.yaml            # API documentation
└── package.json            # Dependencies
```

## Coding Standards

### TypeScript
- Use strict mode
- Avoid `any` type
- Use interfaces for object shapes
- Export types explicitly

### File naming
- Components: PascalCase (e.g., `SearchService.ts`)
- Utilities: camelCase (e.g., `logger.ts`)
- Routes: kebab-case with description (e.g., `search.ts`)

### Code style
- Use 2-space indentation
- Max line length: 100 characters
- Use single quotes for strings
- Add JSDoc comments for public methods

### Git commits
- Use conventional commits: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Example: `feat(search): add anime filtering`

## Debugging

### Debug mode

```bash
NODE_DEBUG=* npm run dev
```

### VS Code Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/dist/server.js",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

### Logging

Use the logger utility:

```typescript
import { logger } from '../utils/logger';

logger.info('User logged in', { userId: user.id });
logger.error('Database error', { error: err.message });
logger.debug('Cache hit', { key });
```

## Database

### Create migration

```bash
npx prisma migrate dev --name add_new_table
```

### View database

```bash
docker-compose exec postgres psql -U pepito -d pepitostream
```

### Reset database

```bash
npx prisma migrate reset
```

## Performance

### Enable caching

```typescript
import { cacheService } from '../services/cacheService';

const data = await cacheService.get('key');
if (!data) {
  const result = await fetchData();
  await cacheService.set('key', result, 3600); // 1 hour TTL
}
```

### Monitor performance

```bash
# Check endpoint response times
npm run test:perf
```

## Troubleshooting

### Port already in use

```bash
# Find and kill process on port 3000
lsof -i :3000
kill -9 <PID>
```

### Database connection error

```bash
# Check if PostgreSQL is running
docker-compose ps

# Check connection string in .env
cat .env | grep DATABASE_URL
```

### Redis connection error

```bash
# Test Redis connection
docker-compose exec redis redis-cli ping
```

### npm install fails

```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## Support

- Documentation: See `README.md`
- Issues: Create GitHub issue with `[BUG]` or `[FEATURE]` prefix
- Discussions: Use GitHub Discussions for questions
- Security: Email security@pepitostream.com