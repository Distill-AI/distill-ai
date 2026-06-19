import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request } from './entities/request.entity';
import { RequestModelAction } from './requests.model-action';

@Module({
  imports: [TypeOrmModule.forFeature([Request])],
  providers: [RequestModelAction],
  exports: [RequestModelAction],
})
export class RequestsModule {}
