export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

// Reads a numeric status off common error shapes (Octokit RequestError has
// `.status`, AIError carries it too).
function getHttpStatus(error: unknown): number | null {
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
}

// Respects an upstream Retry-After hint when present: the Retry-After header
// from Octokit's `error.response.headers`, or the value an AI error attached.
function getRetryAfterMs(error: unknown): number | null {
  const retryAfterSeconds = (error as { retryAfterSeconds?: unknown }).retryAfterSeconds;
  if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  const headers = (error as { response?: { headers?: Record<string, unknown> } })
    .response?.headers;
  const value = headers?.['retry-after'];
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  return null;
}

// Retries on explicit rate limits (429) and transient upstream server errors
// (5xx). Anything else is treated as a real failure and rethrown immediately.
export function defaultIsRetryable(error: unknown): boolean {
  const status = getHttpStatus(error);
  if (status === 429) return true;
  if (status !== null && status >= 500 && status < 600) return true;
  return false;
}

// Wraps an upstream call with exponential backoff so a temporary 429/5xx waits
// and retries instead of crashing the request. After `maxRetries` attempts the
// last error is rethrown unchanged (so callers can still map 429s correctly).
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    isRetryable = defaultIsRetryable,
    onRetry,
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !isRetryable(error)) throw error;

      const delayMs = Math.min(
        getRetryAfterMs(error) ?? baseDelayMs * 2 ** (attempt - 1),
        maxDelayMs,
      );
      onRetry?.(error, attempt, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}