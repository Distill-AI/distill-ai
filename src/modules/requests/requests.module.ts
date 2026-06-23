import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SseModule } from '../../sse/sse.module';
import { EventsModule } from '../events/events.module';
import { Request } from './entities/request.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { RequestModelAction } from './requests.model-action';
import { RequestsService } from './services/requests.service';
import { StreamService } from './services/stream.service';
import { RequestsController } from './controllers/requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Request, Organization]), SseModule, EventsModule],
  controllers: [RequestsController],
  providers: [RequestModelAction, RequestsService, StreamService],
  exports: [RequestModelAction, RequestsService, StreamService],
})
export class RequestsModule {}
