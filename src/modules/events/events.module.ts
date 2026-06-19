import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SseModule } from '../../sse/sse.module';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditEventModelAction } from './audit-event.model-action';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent]), SseModule],
  providers: [AuditEventModelAction, EventsService],
  exports: [EventsService],
})
export class EventsModule {}
