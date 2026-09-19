import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import type { SessionUser } from '../types';

const router = Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// GitHub scopes this app may request from the consent page.
const VALID_SCOPES = new Set([
  'repo',
  'public_repo',
  'read:user',
  'user:email'
]);

// Step 1 — the frontend consent page redirects the browser here with the
// scopes the user agreed to. GitHub's own consent screen then takes over.
router.get(
  '/auth/github',
  (req: Request, res: Response, next: NextFunction) => {
    const rawScope = typeof req.query.scope === 'string' ? req.query.scope : '';
    const scopes = Array.from(
      new Set(
        rawScope
          .split(' ')
          .map((s) => s.trim())
          .filter((s) => VALID_SCOPES.has(s))
      )
    );

    const requestedScopes = scopes.length > 0 ? scopes : ['repo', 'read:user'];

    passport.authenticate('github', {
      scope: requestedScopes
    })(req, res, next);
  }
);

// Step 2 — GitHub redirects back here once the user approves access.
// profile is loaded, the user is upserted into PostgreSQL, and the session
// is created. Then the browser is sent back to the SPA.
router.get(
  '/auth/github/callback',
  passport.authenticate('github', {
    failureRedirect: `${CLIENT_URL}/?error=auth_failed`
  }),
  (_req: Request, res: Response) => {
    res.redirect(`${CLIENT_URL}/?githubAuth=success`);
  }
);

// Step 3 — Re-authorize GitHub WITHOUT destroying the existing session. Used
// when the access/refresh token can no longer be refreshed but the browser
// session is still valid, so the user just re-consents instead of logging in
// all over again.
router.get(
  '/auth/github/relink',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('github', {
      scope: ['repo', 'read:user']
    })(req, res, next);
  }
);

// Frontend calls this (with credentials) to check if a session already exists.
// Only public-safe fields are returned — the access token stays server-side.
router.get('/auth/me', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = req.user as SessionUser;
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl
  });
});

// Clears the session and cookie.
router.post('/auth/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to log out' });
    }
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.status(200).json({ success: true });
    });
  });
});

export default router;