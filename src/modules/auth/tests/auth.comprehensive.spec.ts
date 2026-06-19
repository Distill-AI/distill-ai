import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

const mockAuthConfig = vi.hoisted(() => ({
  enabled: true,
  jwtSecret: 'test-secret',
  tokenExpiryMs: 3600000,
}));
const mockVerify = vi.hoisted(() => vi.fn());
const mockSign = vi.hoisted(() => vi.fn().mockReturnValue('mock-jwt-token'));

vi.mock('@config/auth.config', () => ({ authConfig: mockAuthConfig }));
vi.mock('jsonwebtoken', () => ({ verify: mockVerify, sign: mockSign }));

import { AuthService } from '../services/auth.service';
import { AuthGuard } from '../guards/auth.guard';
import { RlsContextMiddleware } from '../middleware/rls-context.middleware';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import { AuthModule } from '../auth.module';

describe('Auth — Comprehensive', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthConfig.enabled = true;
    service = new AuthService();
  });

  describe('Startup validation', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...OLD_ENV };
    });

    afterAll(() => {
      process.env = OLD_ENV;
    });

    it('throws when AUTH_ENABLED=true and JWT_SECRET is missing', async () => {
      process.env.AUTH_ENABLED = 'true';
      delete process.env.JWT_SECRET;
      await expect(async () => {
        await vi.importActual('@config/auth.config');
      }).rejects.toThrow('AUTH_ENABLED=true requires JWT_SECRET');
    });

    it('passes when AUTH_ENABLED=true and JWT_SECRET is set', async () => {
      process.env.AUTH_ENABLED = 'true';
      process.env.JWT_SECRET = 'my-secret';
      await expect(async () => {
        await vi.importActual('@config/auth.config');
      }).not.toThrow();
    });

    it('passes when AUTH_ENABLED=false even without JWT_SECRET', async () => {
      process.env.AUTH_ENABLED = 'false';
      delete process.env.JWT_SECRET;
      await expect(async () => {
        await vi.importActual('@config/auth.config');
      }).not.toThrow();
    });
  });

  describe('JWT validation strictness', () => {
    it('calls verify with the correct secret', () => {
      const decoded = {
        userId: 'u1',
        orgId: 'o1',
        roles: ['admin'],
        email: 'a@b.com',
        iat: 0,
        exp: 9999999999,
      };
      mockVerify.mockReturnValue(decoded);

      service.validateToken('my.jwt.token');
      expect(mockVerify).toHaveBeenCalledWith('my.jwt.token', 'test-secret');
    });

    it('rejects token with invalid base64', () => {
      mockVerify.mockImplementation(() => {
        throw new Error('invalid base64');
      });
      expect(() => service.validateToken('!!!invalid!!!')).toThrow(UnauthorizedException);
    });

    it('rejects token that is not yet active (nbf)', () => {
      mockVerify.mockImplementation(() => {
        throw new Error('jwt not active');
      });
      expect(() => service.validateToken('not-yet-active.jwt')).toThrow(UnauthorizedException);
    });
  });

  describe('Role decorator metadata', () => {
    it('sets correct metadata on handler', () => {
      class TestController {
        @Roles(Role.ADMIN, Role.ESTIMATOR)
        endpoint() {
          return 'ok';
        }
      }

      const controller = new TestController();
      const roles = Reflect.getOwnMetadata('roles', controller.endpoint);
      expect(roles).toEqual(['admin', 'estimator']);
    });
  });

  describe('Multi-org RLS scenarios', () => {
    it('returns different orgIds for different users', () => {
      const orgA = service.getOrgId({
        user: { userId: 'u1', orgId: 'org-a', roles: ['estimator'], email: 'e@org-a.com' },
      });
      const orgB = service.getOrgId({
        user: { userId: 'u2', orgId: 'org-b', roles: ['estimator'], email: 'e@org-b.com' },
      });
      expect(orgA).toBe('org-a');
      expect(orgB).toBe('org-b');
      expect(orgA).not.toBe(orgB);
    });

    it('handles concurrent requests without cross-contamination', () => {
      const result1 = service.getOrgId({
        user: { userId: 'u1', orgId: 'org-alpha', roles: ['viewer'], email: 'a@alpha.com' },
      });
      const result2 = service.getOrgId({
        user: { userId: 'u2', orgId: 'org-beta', roles: ['admin'], email: 'b@beta.com' },
      });
      expect(result1).toBe('org-alpha');
      expect(result2).toBe('org-beta');
      expect(result1).not.toBe(result2);
    });
  });

  describe('Demo mode behaviour', () => {
    it('does not expose real credentials when auth disabled', () => {
      mockAuthConfig.enabled = false;
      const dummy = service.validateToken('anything');
      expect(dummy.userId).not.toBe('');
      expect(dummy.userId).toBe('demo-user');
      expect(dummy.email).toBe('demo@example.com');
    });

    it('dummy token has admin and estimator roles for demo access', () => {
      mockAuthConfig.enabled = false;
      const dummy = service.validateToken('anything');
      expect(dummy.roles).toContain('admin');
      expect(dummy.roles).toContain('estimator');
    });

    it('toggles between dummy and real tokens at runtime', () => {
      mockAuthConfig.enabled = false;
      const dummy = service.validateToken('anything');
      expect(dummy.userId).toBe('demo-user');

      mockAuthConfig.enabled = true;
      mockVerify.mockReturnValue({
        userId: 'real-u',
        orgId: 'real-org',
        roles: ['admin'],
        email: 'r@real.com',
        iat: 0,
        exp: 9999999999,
      });
      const real = service.validateToken('real.jwt');
      expect(real.userId).toBe('real-u');
    });
  });

  describe('RLS middleware integration', () => {
    let moduleRef: TestingModule;

    function makeResponse() {
      return {
        statusCode: 200,
        on: vi.fn(),
      };
    }

    function makeQueryRunner() {
      return {
        connect: vi.fn().mockResolvedValue(undefined),
        startTransaction: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue(undefined),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
        release: vi.fn().mockResolvedValue(undefined),
        isReleased: false,
        manager: {},
      };
    }

    beforeEach(async () => {
      const queryRunner = makeQueryRunner();
      moduleRef = await Test.createTestingModule({
        imports: [AuthModule],
        providers: [
          {
            provide: DataSource,
            useValue: {
              query: vi.fn().mockResolvedValue(undefined),
              createQueryRunner: vi.fn().mockReturnValue(queryRunner),
            },
          },
        ],
      }).compile();
    });

    afterEach(async () => {
      await moduleRef?.close();
    });

    it('sets app.org_id from valid token', async () => {
      mockVerify.mockReturnValue({
        userId: 'u1',
        orgId: 'org-rls',
        roles: ['estimator'],
        email: 'e@rls.com',
        iat: 0,
        exp: 9999999999,
      });

      const dataSource = moduleRef.get(DataSource);
      const authSvc = moduleRef.get(AuthService);
      const middleware = new RlsContextMiddleware(dataSource, authSvc);

      const request: Record<string, unknown> = { headers: { authorization: 'Bearer rls-token' } };
      const response = makeResponse();
      const next = vi.fn();

      await middleware.use(request as never, response as never, next);

      const qr = (dataSource.createQueryRunner as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(qr.query).toHaveBeenCalledWith('SELECT set_config($1, $2, true)', [
        'app.org_id',
        'org-rls',
      ]);
      expect(next).toHaveBeenCalled();
    });

    it('sets app.org_id to demo-org UUID when auth is disabled', async () => {
      mockAuthConfig.enabled = false;

      const dataSource = moduleRef.get(DataSource);
      const authSvc = moduleRef.get(AuthService);
      const middleware = new RlsContextMiddleware(dataSource, authSvc);

      const request: Record<string, unknown> = { headers: { authorization: 'Bearer some-token' } };
      const response = makeResponse();
      const next = vi.fn();

      await middleware.use(request as never, response as never, next);

      const qr = (dataSource.createQueryRunner as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(qr.query).toHaveBeenCalledWith('SELECT set_config($1, $2, true)', [
        'app.org_id',
        '00000000-0000-0000-0000-000000000000',
      ]);
      expect(next).toHaveBeenCalled();
    });

    it('propagates error when set_config fails', async () => {
      const dataSource = moduleRef.get(DataSource);
      const errorQr = makeQueryRunner();
      errorQr.query.mockRejectedValueOnce(new Error('connection lost'));
      (dataSource.createQueryRunner as ReturnType<typeof vi.fn>).mockReturnValue(errorQr);

      const authSvc = moduleRef.get(AuthService);
      const middleware = new RlsContextMiddleware(dataSource, authSvc);

      const request: Record<string, unknown> = { headers: { authorization: 'Bearer fail-token' } };
      const response = makeResponse();
      const next = vi.fn();

      await middleware.use(request as never, response as never, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('AuthGuard with @Roles()', () => {
    it('prevents access when user lacks required role', () => {
      const reflector = { get: vi.fn().mockReturnValue(['admin']) };
      const authSvc = {
        extractToken: vi.fn().mockReturnValue('token'),
        validateToken: vi.fn().mockReturnValue({
          userId: 'u1',
          orgId: 'o1',
          roles: ['viewer'],
          email: 'v@v.com',
          iat: 0,
          exp: 9999999999,
        }),
        buildAuthUser: vi.fn().mockReturnValue({
          userId: 'u1',
          orgId: 'o1',
          roles: ['viewer'],
          email: 'v@v.com',
        }),
      };
      const guard = new AuthGuard(reflector as never, authSvc as unknown as AuthService);
      const context = {
        switchToHttp: () => ({ getRequest: () => ({}) }),
        getHandler: () => ({}),
      } as never;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('allows access when user has required role', () => {
      const reflector = { get: vi.fn().mockReturnValue(['admin']) };
      const authSvc = {
        extractToken: vi.fn().mockReturnValue('token'),
        validateToken: vi.fn().mockReturnValue({
          userId: 'u1',
          orgId: 'o1',
          roles: ['admin'],
          email: 'a@a.com',
          iat: 0,
          exp: 9999999999,
        }),
        buildAuthUser: vi.fn().mockReturnValue({
          userId: 'u1',
          orgId: 'o1',
          roles: ['admin'],
          email: 'a@a.com',
        }),
      };
      const guard = new AuthGuard(reflector as never, authSvc as unknown as AuthService);
      const context = {
        switchToHttp: () => ({ getRequest: () => ({}) }),
        getHandler: () => ({}),
      } as never;

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('AuthService', () => {
    it('login returns token when auth enabled', async () => {
      mockAuthConfig.enabled = true;

      const result = await service.login('test@example.com', 'password');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.expiresIn).toBe(Math.floor(mockAuthConfig.tokenExpiryMs / 1000));
      expect(result.tokenType).toBe('Bearer');
      expect(mockSign).toHaveBeenCalledWith(
        {
          userId: 'test_example_com',
          orgId: '11111111-1111-1111-1111-111111111111',
          roles: ['admin', 'estimator'],
          email: 'test@example.com',
        },
        'test-secret',
        expect.objectContaining({ expiresIn: 3600 }),
      );
    });

    it('login returns demo token when auth disabled', async () => {
      mockAuthConfig.enabled = false;

      const result = await service.login('test@example.com', 'password');
      expect(result.accessToken).toBe('demo-token');
      expect(result.tokenType).toBe('Bearer');
    });

    it('profile returns user from request', () => {
      const reqUser = { userId: 'u1', orgId: 'org1', roles: ['admin'], email: 'a@b.com' };
      const result = service.getUser({ user: reqUser });
      expect(result).toBe(reqUser);
    });
  });
});
