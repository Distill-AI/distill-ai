import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { DataSource, QueryRunner, EntityManager } from 'typeorm';
import { AuthService } from '../services/auth.service';
import { authConfig } from '@config/auth.config';
import type { Response } from 'express';

interface RlsRequest {
  headers?: Record<string, string | string[] | undefined>;
  queryRunner?: QueryRunner;
  entityManager?: EntityManager;
}

@Injectable()
export class RlsContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RlsContextMiddleware.name);

  constructor(
    private dataSource: DataSource,
    private authService: AuthService,
  ) {}

  async use(
    request: RlsRequest,
    response: Response,
    next: (error?: unknown) => void,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let hasError = false;
    const wrappedNext: typeof next = (error) => {
      if (error) hasError = true;
      next(error);
    };

    try {
      let orgId = '00000000-0000-0000-0000-000000000000';
      if (authConfig.enabled) {
        const token = this.authService.extractToken(request);
        if (token) {
          const decoded = this.authService.validateToken(token);
          orgId = decoded.orgId;
        }
      }

      await queryRunner.query('SELECT set_config($1, $2, true)', ['app.org_id', orgId]);

      request.queryRunner = queryRunner;
      request.entityManager = queryRunner.manager;

      response.on('finish', async () => {
        try {
          if (!queryRunner.isReleased) {
            if (hasError || response.statusCode >= 400) {
              await queryRunner.rollbackTransaction();
            } else {
              await queryRunner.commitTransaction();
            }
            await queryRunner.release();
          }
        } catch (error) {
          this.logger.error('Failed to finalize RLS transaction:', error);
        }
      });

      response.on('close', async () => {
        try {
          if (!queryRunner.isReleased) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
          }
        } catch (error) {
          this.logger.error('Failed to rollback on close:', error);
        }
      });
    } catch (error) {
      try {
        if (!queryRunner.isReleased) {
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
        }
      } catch (cleanupError) {
        this.logger.error('RLS cleanup error:', cleanupError);
      }
      this.logger.error('RLS context error:', error);
      wrappedNext(error);
      return;
    }

    wrappedNext();
  }
}
