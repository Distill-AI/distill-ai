import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '@modules/redis/redis.service';
import * as SYS_MSG from '@constants/system-messages';
import { HealthCheckDocs } from './docs/health-swagger.doc';

interface CheckResult {
  status: 'up' | 'down';
  responseTimeMs?: number;
  error?: string;
}

interface HealthChecks {
  database: CheckResult;
  redis: CheckResult;
}

interface HealthData {
  status: 'ok' | 'degraded';
  checks: HealthChecks;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @HealthCheckDocs()
  async check(): Promise<{ statusCode: number; message: string; data: HealthData }> {
    const checks: HealthChecks = {
      database: { status: 'up' },
      redis: { status: 'up' },
    };

    const dbStart = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = { status: 'up', responseTimeMs: Date.now() - dbStart };
    } catch (err) {
      checks.database = { status: 'down', error: (err as Error).message };
    }

    const redisStart = Date.now();
    try {
      await this.redisService.ping();
      checks.redis = { status: 'up', responseTimeMs: Date.now() - redisStart };
    } catch (err) {
      checks.redis = { status: 'down', error: (err as Error).message };
    }

    const allUp = checks.database.status === 'up' && checks.redis.status === 'up';

    if (!allUp) {
      throw new HttpException(
        {
          message: SYS_MSG.HEALTH_DEGRADED,
          error: 'Service Unavailable',
          details: { checks },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.HEALTH_OK,
      data: {
        status: 'ok',
        checks,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
