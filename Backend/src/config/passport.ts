import passport from 'passport';
import { Strategy as GitHubStrategy, Profile } from 'passport-github2';
import dotenv from 'dotenv';
import { findUserById, toSessionUser, upsertGitHubUser } from '../models/user';

dotenv.config({ quiet: true });

// Extra fields GitHub returns on the token endpoint when short-lived tokens
// are enabled. passport passes them to the verify callback (in place of the
// usual 3rd argument) when the callback declares 5 parameters.
interface GitHubTokenParams {
  expires_in?: number;
  refresh_token_expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      callbackURL:
        process.env.GITHUB_CALLBACK_URL ||
        'http://localhost:3000/auth/github/callback',
      // "repo" grants access to private repos too — required to fetch them later
      scope: ['repo', 'read:user']
    },
    async (
      accessToken: string,
      refreshToken: string,
      params: GitHubTokenParams,
      profile: Profile,
      done: (error: unknown, user?: Express.User | false) => void
    ) => {
      try {
        const now = Date.now();
        // GitHub returns the refresh token and lifetimes in `params`; some
        // exchanges put the access token there too. Normalize from both so a
        // missing field never silently disables refresh.
        const resolvedAccessToken = params.access_token ?? accessToken;
        const resolvedRefreshToken = params.refresh_token ?? refreshToken;
        const accessTokenExpiresAt = params.expires_in
          ? new Date(now + params.expires_in * 1000)
          : undefined;
        const refreshTokenExpiresAt = params.refresh_token_expires_in
          ? new Date(now + params.refresh_token_expires_in * 1000)
          : undefined;

        console.log(
          '[oauth] token issued',
          JSON.stringify({
            userId: profile.id,
            hasAccessToken: Boolean(resolvedAccessToken),
            hasRefreshToken: Boolean(resolvedRefreshToken),
            expiresInSeconds: params.expires_in ?? null,
            refreshTokenExpiresInSeconds: params.refresh_token_expires_in ?? null,
            accessTokenExpiresAt: accessTokenExpiresAt?.toISOString() ?? null,
            refreshTokenExpiresAt: refreshTokenExpiresAt?.toISOString() ?? null
          })
        );

        const record = await upsertGitHubUser({
          id: profile.id,
          username: profile.username || '',
          displayName: profile.displayName || profile.username || '',
          avatarUrl: profile.photos?.[0]?.value,
          accessToken: resolvedAccessToken,
          refreshToken: resolvedRefreshToken || undefined,
          accessTokenExpiresAt,
          refreshTokenExpiresAt
        });

        return done(null, toSessionUser(record));
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Only the database row id is stored in the session. All other user data
// (including the access token) lives in PostgreSQL and is fetched on demand.
passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

passport.deserializeUser(
  async (serialized: unknown, done: (error: unknown, user?: Express.User | false) => void) => {
    try {
      const userId =
        typeof serialized === 'object' &&
        serialized !== null &&
        typeof (serialized as { id?: unknown }).id === 'number'
          ? (serialized as { id: number }).id
          : typeof serialized === 'number'
            ? serialized
            : null;

      if (userId === null) {
        return done(null, false);
      }

      const record = await findUserById(userId);
      if (!record) {
        return done(null, false);
      }

      return done(null, toSessionUser(record));
    } catch (error) {
      return done(error);
    }
  }
);

export default passport;