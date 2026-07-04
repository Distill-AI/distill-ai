import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { authConfig } from '@config/auth.config';
import type { DecodedToken, AuthUser } from '../interfaces/';
import * as SYS_MSG from '@constants/system-messages';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';

@Injectable()
export class AuthService {
  login(
    _email: string,
    _password: string,
  ): { accessToken: string; expiresIn: number; tokenType: string } {
    if (authConfig.enabled) {
      throw new CustomHttpException(SYS_MSG.AUTH_LOGIN_NOT_IMPLEMENTED, HttpStatus.NOT_IMPLEMENTED);
    }
    return {
      accessToken: 'demo-token',
      expiresIn: Math.floor(authConfig.tokenExpiryMs / 1000),
      tokenType: 'Bearer',
    };
  }

  extractToken(request: {
    headers?: Record<string, string | string[] | undefined>;
  }): string | null {
    const header = request.headers?.authorization;
    if (typeof header !== 'string') return null;
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
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
    if (!authConfig.enabled) return this.dummyUser();
    if (!request.user) throw new UnauthorizedException(SYS_MSG.AUTH_UNAUTHORIZED);
    return request.user;
  }

  getOrgId(request: { user?: AuthUser }): string {
    return this.getUser(request).orgId;
  }

  private dummyToken(): DecodedToken {
    return {
      userId: 'demo-user',
      orgId: '00000000-0000-0000-0000-000000000000',
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
