import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { Database } from "../db";
import { createProfilesRouter } from "./routes/profiles";
import { createPostsRouter } from "./routes/posts";
import { createFollowsRouter } from "./routes/follows";
import { createPoolsRouter } from "./routes/pools";

// ── Rate-limit configuration (all values are env-overridable) ────────────────

let RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10);
let RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10);

/**
 * Override rate-limit values at runtime (useful in tests).
 */
export function setRateLimit(windowMs: number, max: number): void {
  RATE_LIMIT_WINDOW_MS = windowMs;
  RATE_LIMIT_MAX = max;
}

// ── Rate limiter middleware factory ──────────────────────────────────────────

function createLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      const forwarded = req.headers["x-forwarded-for"];
      if (typeof forwarded === "string") {
        return forwarded.split(",")[0].trim();
      }
      return req.ip ?? "unknown";
    },
    handler: (req: Request, res: Response): void => {
      const retryAfter = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
      res.status(429).set("Retry-After", String(retryAfter)).json({
        error: "Too many requests. Please retry after the indicated delay.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: retryAfter,
      });
    },
  });
}

// ── App factory ───────────────────────────────────────────────────────────────

export function createApp(db: Database): express.Application {
  const app = express();

  // ── CORS ──────────────────────────────────────────────────────────────────────
  app.use(cors());

  app.use(express.json());

  // ── Health check (unlimited) ────────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response): void => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Apply rate limiting to all /api routes.
  const apiLimiter = createLimiter();
  app.use("/api", apiLimiter);

  // ── Resource routes ────────────────────────────────────────────────────────
  app.use("/api/profiles", createProfilesRouter(db));
  app.use("/api/posts", createPostsRouter(db));
  app.use("/api/follows", createFollowsRouter(db));
  app.use("/api/pools", createPoolsRouter(db));

  // ── Search endpoint ──────────────────────────────────────────────────────────

  interface SearchQuery {
    query: string;
    limit?: number;
    offset?: number;
  }

  interface SearchResponse {
    posts: Array<{
      id: string;
      author: string;
      content: string;
      tip_total: string;
      like_count: string;
      created_ledger: number;
    }>;
    total: number;
    has_more: boolean;
  }

  interface ErrorResponse {
    error: string;
    code: string;
  }

  const MAX_LIMIT = 100;
  const DEFAULT_LIMIT = 20;
  const DEFAULT_OFFSET = 0;

  app.post(
    "/api/search/posts",
    async (req: Request, res: Response<SearchResponse | ErrorResponse>): Promise<void> => {
      const body = req.body as Partial<SearchQuery>;

      if (
        body.query === undefined ||
        body.query === null ||
        typeof body.query !== "string" ||
        body.query.trim() === ""
      ) {
        res.status(400).json({ error: "query is required", code: "INVALID_QUERY" });
        return;
      }

      const limit = body.limit !== undefined ? Number(body.limit) : DEFAULT_LIMIT;
      const offset = body.offset !== undefined ? Number(body.offset) : DEFAULT_OFFSET;

      if (!Number.isInteger(limit) || limit < 1) {
        res.status(400).json({ error: "limit must be a positive integer", code: "INVALID_QUERY" });
        return;
      }

      if (limit > MAX_LIMIT) {
        res.status(400).json({
          error: `limit cannot exceed ${MAX_LIMIT}`,
          code: "LIMIT_EXCEEDED",
        });
        return;
      }

      if (!Number.isInteger(offset) || offset < 0) {
        res
          .status(400)
          .json({ error: "offset must be a non-negative integer", code: "INVALID_QUERY" });
        return;
      }

      const { posts, total } = await db.searchPosts(body.query.trim(), limit, offset);
      res.json({
        posts: posts.map((p) => ({
          id: String(p.id),
          author: p.author,
          content: p.content,
          tip_total: String(p.tip_total),
          like_count: String(p.like_count),
          created_ledger: p.created_ledger,
        })),
        total,
        has_more: offset + posts.length < total,
      });
    }
  );

  // ── Error handler ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error(err);
    res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  });

  return app;
}

// Back-compat: export a pre-built app for tests that import it directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _stub = {} as any;
export const app = createApp(_stub);

// ── Server bootstrap (skipped when imported in tests) ────────────────────────

if (require.main === module) {
  const PORT = parseInt(process.env.PORT ?? "3001", 10);
  app.listen(PORT, () => {
    console.log(`Indexer API listening on port ${PORT}`);
    console.log(
      `Rate limit: ${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW_MS / 1000}s per IP`
    );
  });
}
