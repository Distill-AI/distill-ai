import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SseModule } from '../../sse/sse.module';
import { AuditEvent } from './entities/audit-event.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { User } from '../users/entities/user.entity';
import { AuditEventModelAction } from './audit-event.model-action';
import { EventsService } from './events.service';

@Module({
  // AuditEvent relates to Quote and User, and Quote also relates to User. Neither has its own module
  // registering it via forFeature yet, so register the closure here or autoLoadEntities cannot
  // resolve those relations and the app fails to boot. (Organization/Request come from RequestsModule.)
  imports: [TypeOrmModule.forFeature([AuditEvent, Quote, User]), SseModule],
  providers: [AuditEventModelAction, EventsService],
  exports: [EventsService],
})
export class EventsModule {}
