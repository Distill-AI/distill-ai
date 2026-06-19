import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../services/auth.service';
import { authConfig } from '@config/auth.config';
import { SYS_MSG } from '@constants/system-messages';
import type { AuthUser } from '../interfaces/';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser; headers?: Record<string, string | string[] | undefined> }>();

    if (!authConfig.enabled) return true;

    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    try {
      const token = this.authService.extractToken(request);
      if (!token) throw new UnauthorizedException(SYS_MSG.AUTH_UNAUTHORIZED);

      const decoded = this.authService.validateToken(token);
      request.user = this.authService.buildAuthUser(decoded);

      const hasRole = requiredRoles.some((role) => request.user!.roles.includes(role));
      if (!hasRole) throw new ForbiddenException(SYS_MSG.AUTH_FORBIDDEN);

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException)
        throw error;
      throw new UnauthorizedException(SYS_MSG.AUTH_UNAUTHORIZED);
    }
  }
}
