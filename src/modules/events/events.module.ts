import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SseModule } from '../../sse/sse.module';
import { AuditEvent } from './entities/audit-event.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { User } from '../users/entities/user.entity';
import { AuditEventModelAction } from './audit-event.model-action';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent, Quote, User]), SseModule],
  providers: [AuditEventModelAction, EventsService],
  exports: [EventsService],
})
export class EventsModule {}
