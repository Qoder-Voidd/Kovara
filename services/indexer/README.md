# Kovara Indexer

Event indexer for the Kovara Social contract on Stellar. Processes on-chain events and maintains a queryable database for the frontend.

## Architecture

The indexer listens to Stellar contract events and processes them into a PostgreSQL database:

- **Event Handlers**: Process specific event types (PostCreated, TipEvent, LikeEvent, etc.)
- **Database**: PostgreSQL with migrations for schema management
- **Idempotency**: All handlers are idempotent using unique constraints and transaction hashes

## Event Handlers

### Post Handlers (`src/handlers/post.ts`)

- **PostCreatedEvent**: Inserts new posts into the `posts` table
- **PostDeletedEvent**: Soft deletes posts by setting `deleted_at` timestamp

### Tip Handler (`src/handlers/tip.ts`)

- **TipEvent**: Records tips in `tips` table and increments `tip_total` on posts
- Idempotent via `tx_hash` unique constraint

### Like Handler (`src/handlers/like.ts`)

- **LikePostEvent**: Records likes in `likes` table and increments `like_count` on posts
- Idempotent via `(post_id, user_address)` unique constraint

## Database Schema

### Posts Table

```sql
CREATE TABLE posts (
    id BIGINT PRIMARY KEY,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    tip_total BIGINT NOT NULL DEFAULT 0,
    like_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP DEFAULT NULL
);
```

### Tips Table

```sql
CREATE TABLE tips (
    id SERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id),
    tipper TEXT NOT NULL,
    amount BIGINT NOT NULL,
    fee BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    tx_hash TEXT NOT NULL UNIQUE
);
```

### Likes Table

```sql
CREATE TABLE likes (
    id SERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id),
    user_address TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    tx_hash TEXT NOT NULL UNIQUE,
    UNIQUE (post_id, user_address)
);
```

## Local Setup (Docker)

The fastest way to run the indexer and PostgreSQL together is Docker Compose.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose v2

### Steps

```bash
# 1. Copy and edit environment variables
cp .env.example .env
# Edit .env — set CONTRACT_ID, START_LEDGER, and STELLAR_RPC_URL at minimum

# 2. Start both services (migrations run automatically on first boot)
docker compose up --build
```

The indexer API will be available at `http://localhost:3000`.
PostgreSQL is exposed on port `5432`.

To stop and remove containers:

```bash
docker compose down
```

To also remove the database volume:

```bash
docker compose down -v
```

### Environment Variables

See [`.env.example`](.env.example) for all required variables.

| Variable               | Description                            |
| ---------------------- | -------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string           |
| `STELLAR_RPC_URL`      | Soroban RPC endpoint                   |
| `CONTRACT_ID`          | Deployed Kovara contract address       |
| `START_LEDGER`         | Ledger sequence to start indexing from |
| `PORT`                 | API port (default: `3000`)             |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window in ms (default: 60000) |
| `RATE_LIMIT_MAX`       | Max requests per window (default: 100) |
| `CORS_ORIGIN`          | Allowed CORS origin(s) (default: all)  |

## Manual Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
npm install
```

### Database Setup

```bash
# Apply migrations manually
psql "$DATABASE_URL" -f migrations/001_profiles.sql
psql "$DATABASE_URL" -f migrations/002_posts.sql
psql "$DATABASE_URL" -f migrations/003_follows.sql
psql "$DATABASE_URL" -f migrations/004_tips_likes.sql
psql "$DATABASE_URL" -f migrations/005_pools.sql
```

### Configuration

```bash
cp .env.example .env
# Edit .env with your values
```

## Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- post.test.ts
```

## Idempotency

All event handlers are designed to be idempotent:

1. **PostCreatedEvent**: Uses `ON CONFLICT (id) DO NOTHING`
2. **PostDeletedEvent**: Only updates if `deleted_at IS NULL`
3. **TipEvent**: Uses `tx_hash` unique constraint
4. **LikeEvent**: Uses `(post_id, user_address)` unique constraint

This ensures the indexer can safely replay events without data corruption.

## CORS

The API uses the [`cors`](https://www.npmjs.com/package/cors) middleware and allows
all origins by default. To restrict access in production, set the `CORS_ORIGIN`
environment variable:

```bash
# Allow a single origin
CORS_ORIGIN=https://app.example.com

# Allow multiple origins (comma-separated)
CORS_ORIGIN=https://app.example.com,https://admin.example.com
```

When `CORS_ORIGIN` is not set, all origins are permitted (useful during development).
See `.env.example` for the full list of environment variables.

## Rate Limiting

All `/api/*` routes are protected by a rate limiter (express-rate-limit). The
default window is 60 seconds with 100 requests per IP. Configurable via:

| Variable               | Default | Description                          |
| ---------------------- | ------- | ------------------------------------ |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window duration in milliseconds      |
| `RATE_LIMIT_MAX`       | `100`   | Maximum requests per window per IP   |

When the limit is exceeded, the API returns `429 Too Many Requests` with a
`Retry-After` header and a JSON body containing `RATE_LIMIT_EXCEEDED`.

## Full-Text Search

Search across indexed post content:

```bash
curl -X POST http://localhost:3000/api/search/posts \
  -H "Content-Type: application/json" \
  -d '{"query": "stellar", "limit": 10, "offset": 0}'
```

The search uses PostgreSQL full-text search (`tsvector`/`tsquery`) for efficient
content matching. Results include `id`, `author`, `content`, `tip_total`,
`like_count`, and `created_ledger`.

## Token Metadata Enrichment

Pool responses include optional token metadata when available:

```json
{
  "pool_id": "...",
  "token": "GABCD...",
  "token_name": "Kovara Token",
  "token_symbol": "KOVA",
  "token_decimals": 7,
  ...
}
```

Metadata is fetched via the `getTokenMetadata` database method, which can be
populated from on-chain contract data or a supplementary table.

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Returns `200 OK` with `{ "status": "ok", "uptime": <seconds> }`.

### Metrics

- Events processed per second
- Database query latency
- Failed event count
- Current indexed ledger

## Deployment

### Docker

```bash
docker build -t Kovara-indexer .
docker run -p 3000:3000 --env-file .env Kovara-indexer
```

### Kubernetes

```bash
kubectl apply -f k8s/deployment.yaml
```

## Troubleshooting

### Indexer falls behind

- Check Stellar RPC rate limits
- Increase database connection pool size
- Scale horizontally with multiple indexer instances

### Duplicate events

- Verify idempotency constraints are in place
- Check transaction hash uniqueness
- Review event replay logic

### Missing events

- Verify START_LEDGER is correct
- Check Stellar RPC connectivity
- Review event filter configuration

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT
