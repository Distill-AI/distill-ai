import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { AuthService } from '../services/auth.service';
import { authConfig } from '@config/auth.config';

@Injectable()
export class RlsContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RlsContextMiddleware.name);

  constructor(
    private dataSource: DataSource,
    private authService: AuthService,
  ) {}

  async use(
    request: { headers?: Record<string, string | string[] | undefined> },
    _response: unknown,
    next: () => void,
  ): Promise<void> {
    if (!authConfig.enabled) {
      next();
      return;
    }

    try {
      const token = this.authService.extractToken(request);
      if (token) {
        const decoded = this.authService.validateToken(token);
        await this.dataSource.query('SET app.org_id = $1', [decoded.orgId]);
      }
    } catch (error) {
      this.logger.error('RLS context error:', error);
    }

    next();
  }
}
