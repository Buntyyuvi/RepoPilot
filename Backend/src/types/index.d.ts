export interface GitHubUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
}

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

// Makes req.user (and passport's serialize/deserialize) type-safe everywhere
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends SessionUser {}
  }
}