import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verify, sign } from 'jsonwebtoken';
import { authConfig } from '@config/auth.config';
import type { DecodedToken, AuthUser } from '../interfaces/';
import * as SYS_MSG from '@constants/system-messages';

@Injectable()
export class AuthService {
  login(
    email: string,
    _password: string,
  ): { accessToken: string; expiresIn: number; tokenType: string } {
    if (!authConfig.enabled) {
      return {
        accessToken: 'demo-token',
        expiresIn: authConfig.tokenExpiryMs,
        tokenType: 'Bearer',
      };
    }
    const payload = {
      userId: email.replace(/[^a-z0-9]/gi, '_'),
      orgId: 'default-org',
      roles: ['admin', 'estimator'],
      email,
    };
    const accessToken = sign(payload, authConfig.jwtSecret, {
      expiresIn: Math.floor(authConfig.tokenExpiryMs / 1000),
    });
    return { accessToken, expiresIn: authConfig.tokenExpiryMs, tokenType: 'Bearer' };
  }

  extractToken(request: {
    headers?: Record<string, string | string[] | undefined>;
  }): string | null {
    const header = request.headers?.authorization;
    return typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
  }

  validateToken(token: string): DecodedToken {
    if (!authConfig.enabled) return this.dummyToken();

    try {
      const decoded = verify(token, authConfig.jwtSecret) as DecodedToken;
      if (!decoded.userId || !decoded.orgId || !decoded.roles || !decoded.email) {
        throw new Error('Missing required claims');
      }
      return decoded;
    } catch {
      throw new UnauthorizedException(SYS_MSG.AUTH_INVALID_TOKEN);
    }
  }

  buildAuthUser(decoded: DecodedToken): AuthUser {
    return {
      userId: decoded.userId,
      orgId: decoded.orgId,
      roles: decoded.roles,
      email: decoded.email,
    };
  }

  getUser(request: { user?: AuthUser }): AuthUser {
    return authConfig.enabled ? request.user! : this.dummyUser();
  }

  getOrgId(request: { user?: AuthUser }): string {
    return this.getUser(request).orgId;
  }

  private dummyToken(): DecodedToken {
    return {
      userId: 'demo-user',
      orgId: 'demo-org',
      roles: ['admin', 'estimator'],
      email: 'demo@example.com',
      iat: 0,
      exp: 9999999999,
    };
  }

  private dummyUser(): AuthUser {
    const token = this.dummyToken();
    return { userId: token.userId, orgId: token.orgId, roles: token.roles, email: token.email };
  }
}
