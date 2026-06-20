import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { MockedObject } from 'vitest';

const mockAuthConfig = vi.hoisted(() => ({
  enabled: true,
  jwtSecret: 'test-secret',
  tokenExpiryMs: 3600000,
}));

vi.mock('@config/auth.config', () => ({ authConfig: mockAuthConfig }));

import { AuthGuard } from '../guards/auth.guard';
import type { AuthService } from '../services/auth.service';

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    user: undefined,
    ...overrides,
  };
}

function makeContext(request: Record<string, unknown>, handler = () => ({})): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => ({}) as never,
    switchToRpc: () => {
      throw new Error('not implemented');
    },
    switchToWs: () => {
      throw new Error('not implemented');
    },
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: MockedObject<{ get: ReturnType<typeof vi.fn> }>;
  let authService: MockedObject<
    Pick<AuthService, 'extractToken' | 'validateToken' | 'buildAuthUser'>
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    reflector = { get: vi.fn() } as unknown as MockedObject<{ get: ReturnType<typeof vi.fn> }>;
    authService = {
      extractToken: vi.fn(),
      validateToken: vi.fn(),
      buildAuthUser: vi.fn(),
    } as unknown as MockedObject<
      Pick<AuthService, 'extractToken' | 'validateToken' | 'buildAuthUser'>
    >;
    guard = new AuthGuard(reflector as never, authService as unknown as AuthService);
  });

  describe('when AUTH_ENABLED=false', () => {
    beforeEach(() => {
      mockAuthConfig.enabled = false;
    });

    it('returns true for any request', () => {
      const request = makeRequest();
      const context = makeContext(request);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('bypasses token extraction and role checking', () => {
      const request = makeRequest();
      const context = makeContext(request);
      guard.canActivate(context);
      expect(authService.extractToken).not.toHaveBeenCalled();
    });
  });

  describe('when AUTH_ENABLED=true', () => {
    beforeEach(() => {
      mockAuthConfig.enabled = true;
    });

    it('returns true when token is valid and role matches', () => {
      reflector.get.mockReturnValue(['admin']);
      authService.extractToken.mockReturnValue('valid-token');
      authService.validateToken.mockReturnValue({
        userId: 'u1',
        orgId: 'org1',
        roles: ['admin'],
        email: 'a@b.com',
        iat: 0,
        exp: 9999999999,
      });
      authService.buildAuthUser.mockReturnValue({
        userId: 'u1',
        orgId: 'org1',
        roles: ['admin'],
        email: 'a@b.com',
      });

      const request = makeRequest();
      const context = makeContext(request);
      expect(guard.canActivate(context)).toBe(true);
      expect((request as Record<string, unknown>).user).toBeDefined();
    });

    it('throws 401 when token is missing', () => {
      reflector.get.mockReturnValue(['admin']);
      authService.extractToken.mockReturnValue(null);

      const request = makeRequest();
      const context = makeContext(request);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('throws 401 when token is invalid', () => {
      reflector.get.mockReturnValue(['admin']);
      authService.extractToken.mockReturnValue('bad-token');
      authService.validateToken.mockImplementation(() => {
        throw new UnauthorizedException();
      });

      const request = makeRequest();
      const context = makeContext(request);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('throws 403 when user lacks required role', () => {
      reflector.get.mockReturnValue(['admin']);
      authService.extractToken.mockReturnValue('valid-token');
      authService.validateToken.mockReturnValue({
        userId: 'u1',
        orgId: 'org1',
        roles: ['viewer'],
        email: 'a@b.com',
        iat: 0,
        exp: 9999999999,
      });
      authService.buildAuthUser.mockReturnValue({
        userId: 'u1',
        orgId: 'org1',
        roles: ['viewer'],
        email: 'a@b.com',
      });

      const request = makeRequest();
      const context = makeContext(request);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('returns true when handler has no @Roles() decorator', () => {
      reflector.get.mockReturnValue(undefined);

      const request = makeRequest();
      const context = makeContext(request);
      expect(guard.canActivate(context)).toBe(true);
      expect(authService.extractToken).not.toHaveBeenCalled();
    });

    it('wraps unknown errors as 401', () => {
      reflector.get.mockReturnValue(['admin']);
      authService.extractToken.mockImplementation(() => {
        throw new Error('unexpected');
      });

      const request = makeRequest();
      const context = makeContext(request);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });
});
