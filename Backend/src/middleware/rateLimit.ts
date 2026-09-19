import rateLimit from 'express-rate-limit';

const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
const apiMax = Number.parseInt(process.env.RATE_LIMIT_MAX ?? '120', 10);
const authMax = Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '10', 10);

// Per-IP cap on all API routes. Counters live in-process (correct for a single
// server instance; the index worker is a separate process and never serves
// HTTP). Swap in a Redis-backed store before running multiple API instances.
export const apiLimiter = rateLimit({
  windowMs,
  limit: apiMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

// Stricter cap for the GitHub OAuth entry points so a single IP cannot spam
// consent redirects. Applied in addition to the global apiLimiter.
export const authLimiter = rateLimit({
  windowMs,
  limit: authMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});