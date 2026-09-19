import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Adds a unique id to every request so log lines (morgan) and error entries
// (error middleware / Sentry) can be correlated for a single user action.
export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestContext(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void {
  const incoming = req.get('X-Request-Id');
  const id = incoming && /^[A-Za-z0-9-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}