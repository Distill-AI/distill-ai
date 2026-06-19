import { UnauthorizedException } from '@nestjs/common';

const mockAuthConfig = vi.hoisted(() => ({
  enabled: true,
  jwtSecret: 'test-secret',
  tokenExpiryMs: 3600000,
}));
const mockVerify = vi.hoisted(() => vi.fn());

vi.mock('@config/auth.config', () => ({ authConfig: mockAuthConfig }));
vi.mock('jsonwebtoken', () => ({ verify: mockVerify }));

import { AuthService } from '../services/auth.service';
import type { DecodedToken } from '../interfaces/';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
  });

  describe('extractToken', () => {
    it('extracts Bearer token from Authorization header', () => {
      const result = service.extractToken({ headers: { authorization: 'Bearer my-token' } });
      expect(result).toBe('my-token');
    });

    it('returns null when Authorization header is missing', () => {
      const result = service.extractToken({ headers: {} });
      expect(result).toBeNull();
    });

    it('returns null when Authorization header is not Bearer', () => {
      const result = service.extractToken({ headers: { authorization: 'Basic abc123' } });
      expect(result).toBeNull();
    });

    it('returns null when headers are undefined', () => {
      const result = service.extractToken({});
      expect(result).toBeNull();
    });
  });

  describe('validateToken', () => {
    describe('when auth enabled', () => {
      beforeEach(() => {
        mockAuthConfig.enabled = true;
      });

      it('validates a JWT and returns decoded token', () => {
        const decoded: DecodedToken = {
          userId: 'u1',
          orgId: 'org1',
          roles: ['admin'],
          email: 'a@b.com',
          iat: 100,
          exp: 9999999999,
        };
        mockVerify.mockReturnValue(decoded);

        const result = service.validateToken('valid.jwt.here');
        expect(result).toEqual(decoded);
      });

      it('throws 401 when JWT signature verification fails', () => {
        mockVerify.mockImplementation(() => {
          throw new Error('invalid signature');
        });

        expect(() => service.validateToken('bad.jwt.here')).toThrow(UnauthorizedException);
      });

      it('throws 401 when JWT is expired', () => {
        mockVerify.mockImplementation(() => {
          throw new Error('jwt expired');
        });

        expect(() => service.validateToken('expired.jwt.here')).toThrow(UnauthorizedException);
      });

      it('throws 401 when decoded token is missing required claims', () => {
        mockVerify.mockReturnValue({ userId: 'u1' }); // missing orgId, roles, email

        expect(() => service.validateToken('incomplete.jwt.here')).toThrow(UnauthorizedException);
      });
    });

    describe('when auth disabled', () => {
      beforeEach(() => {
        mockAuthConfig.enabled = false;
      });

      it('returns dummy token without calling verify', () => {
        const result = service.validateToken('anything');
        expect(result.userId).toBe('demo-user');
        expect(result.orgId).toBe('00000000-0000-0000-0000-000000000000');
        expect(result.roles).toEqual(['admin', 'estimator']);
        expect(mockVerify).not.toHaveBeenCalled();
      });
    });
  });

  describe('buildAuthUser', () => {
    it('maps DecodedToken to AuthUser correctly', () => {
      const decoded: DecodedToken = {
        userId: 'u42',
        orgId: 'org-abc',
        roles: ['admin', 'estimator'],
        email: 'user@org.com',
        iat: 0,
        exp: 9999999999,
      };
      const user = service.buildAuthUser(decoded);

      expect(user).toEqual({
        userId: 'u42',
        orgId: 'org-abc',
        roles: ['admin', 'estimator'],
        email: 'user@org.com',
      });
    });
  });

  describe('getUser', () => {
    it('returns request.user when auth enabled', () => {
      mockAuthConfig.enabled = true;
      const requestUser = { userId: 'u1', orgId: 'org1', roles: ['admin'], email: 'a@b.com' };
      const result = service.getUser({ user: requestUser });
      expect(result).toBe(requestUser);
    });

    it('returns dummy user when auth disabled', () => {
      mockAuthConfig.enabled = false;
      const result = service.getUser({});
      expect(result.userId).toBe('demo-user');
      expect(result.orgId).toBe('00000000-0000-0000-0000-000000000000');
    });
  });

  describe('getOrgId', () => {
    it('returns orgId from request.user when auth enabled', () => {
      mockAuthConfig.enabled = true;
      const result = service.getOrgId({
        user: { userId: 'u1', orgId: 'my-org', roles: ['admin'], email: 'a@b.com' },
      });
      expect(result).toBe('my-org');
    });

    it('returns demo-org UUID when auth disabled', () => {
      mockAuthConfig.enabled = false;
      const result = service.getOrgId({});
      expect(result).toBe('00000000-0000-0000-0000-000000000000');
    });
  });
});
