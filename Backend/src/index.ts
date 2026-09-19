import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import dotenv from 'dotenv';
import connectPgSimple from 'connect-pg-simple';
import morgan from 'morgan';
import * as Sentry from '@sentry/node';

import './config/passport';
import authRouter from './routes/auth';
import reposRouter from './routes/repos';
import settingsRouter from './routes/settings';
import { initializeSchema } from './config/schema';
import { closeDatabase, db } from './config/database';
import { TokenRefreshError } from './services/github';
import { AIError } from './services/ai';
import { apiLimiter, authLimiter } from './middleware/rateLimit';
import { requestContext, type RequestWithId } from './middleware/requestContext';

// quiet: dotenv logs an "injected env" banner on every boot; keep the process
// logs (and PM2 log files) clean.
dotenv.config({ quiet: true });

// Opt-in Sentry error tracking: initialize ONLY when a DSN is configured, so
// local/dev runs are unaffected and production just needs SENTRY_DSN set.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1
  });
  console.log('[sentry] error tracking enabled');
}

// Process-level safety nets: a single stray rejection or uncaught exception
// must never silently take down the whole server for every user. Log it and
// keep serving; supervisors can restart the process if it becomes unhealthy.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Persist sessions in PostgreSQL instead of in-process memory so users stay
// logged in across restarts (e.g. `tsx watch` reloads) and multiple processes.
const PGSessionStore = connectPgSimple(session);

app.disable('x-powered-by');

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true
  })
);

app.use(express.json());

// One request id for the whole lifecycle: echoed in the morgan line, the
// response header, and any error log / Sentry event, so a failing request can
// be traced end to end.
app.use(requestContext);

// Per-request access log (method url status response-time). Mounted BEFORE the
// rate limiters so limiter 429s are also visible. No cookies/headers/bodies
// are logged, so no sensitive data is written to the log files.
app.use(
  morgan((tokens, req, res) => {
    const requestId = (req as RequestWithId).requestId ?? '-';
    return [
      `[${requestId}]`,
      tokens.method(req, res),
      tokens.url(req, res),
      tokens.status(req, res),
      `${tokens['response-time'](req, res) ?? '?'}ms`,
      tokens['remote-addr'](req, res)
    ].join(' ');
  })
);

app.use(
  session({
    store: new PGSessionStore({
      pool: db,
      createTableIfMissing: true,
      tableName: 'session',
      errorLog: (message) => console.error('Session store error:', message)
    }),
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Per-IP API rate limit, plus a stricter one on the GitHub OAuth entry points
// (authLimiter is applied again as a prefix match so it stacks with the global
// cap). 429s here protect our server the same way we retry upstream 429s.
app.use(apiLimiter);
app.use('/auth/github', authLimiter);

app.use(authRouter);
app.use(reposRouter);
app.use(settingsRouter);

app.get('/', (_req, res) => {
  res.send('Strata API is running.');
});

// 404: anything that reaches here matched no route — respond with JSON instead
// of Express's HTML default page.
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Catch-all error middleware (must be the very last middleware, with exactly
// four args so Express treats it as the error handler). Anything thrown or
// rejected that escaped a route lands here as a JSON response and is logged.
app.use(
  (err: Error, req: RequestWithId, res: express.Response, _next: express.NextFunction) => {
    const requestId = req.requestId ?? '-';
    console.error(`[${requestId}] Unhandled error:`, err);

    if (Sentry.isEnabled()) {
      Sentry.captureException(err, { tags: { requestId } });
    }

    if (err instanceof TokenRefreshError) {
      return res.status(401).json({
        error: err.message,
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }

    if (err instanceof AIError) {
      return res.status(err.status).json({ error: err.message });
    }

    // Honor well-formed status codes carried by library errors, but never
    // leak internal error details to the client.
    const status = Number((err as { status?: unknown }).status) || Number((err as { statusCode?: unknown }).statusCode) || 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: 'Something went wrong'
    });
  }
);

let server: ReturnType<typeof app.listen> | null = null;

async function start(): Promise<void> {
  try {
    await initializeSchema();
    console.log('Database schema initialized.');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    process.exit(1);
  }

  server = app.listen(PORT, () => {
    console.log(`Strata server listening on http://localhost:${PORT}`);
  });
  server.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

// Gracefully drain connections and the database pool on shutdown.
async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out; forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  if (server) {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
  }

  try {
    await closeDatabase();
  } catch (error) {
    console.error('Failed to close database pool:', error);
  }

  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

void start();