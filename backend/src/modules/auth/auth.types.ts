import { UserRole, UserStatus } from '../users/user.entity';

export interface AccessTokenPayload {
  sub: string;
  sessionId: string;
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  sessionId: string;
}

export interface SafeUser {
  id: string;
  name: string;
  phone: string;
  phoneVerified: boolean;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  preferredLanguage: string;
  profileImageUrl: string | null;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: SafeUser;
}
