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
    // Always reset session variable to prevent leakage from pooled connections
    try {
      await this.dataSource.query('RESET app.org_id');
    } catch (error) {
      this.logger.error('Failed to reset RLS context:', error);
    }

    try {
      let orgId = 'demo-org';
      if (authConfig.enabled) {
        const token = this.authService.extractToken(request);
        if (token) {
          const decoded = this.authService.validateToken(token);
          orgId = decoded.orgId;
        }
      }
      await this.dataSource.query('SET app.org_id = $1', [orgId]);
    } catch (error) {
      this.logger.error('RLS context error:', error);
    }

    next();
  }
}
