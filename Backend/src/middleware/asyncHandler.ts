import { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncHandlerFn = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

// Wraps an async route/middleware so any rejection is forwarded to the central
// error middleware instead of escaping into the process. Express 5 already
// forwards rejected async handlers natively, but this helper makes the intent
// explicit and covers async middleware for consistency with future routes.
export function asyncHandler(fn: AsyncHandlerFn): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}