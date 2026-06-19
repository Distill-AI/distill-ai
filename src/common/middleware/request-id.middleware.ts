import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { PinoLoggerService } from '@common/logger/pino-logger.service';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLoggerService) {}

  /** Reads or generates X-Request-Id, echoes it in the response, and seeds the request context for structured logging. */
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    await this.logger.runWithContext({ requestId }, () => next());
  }
}
