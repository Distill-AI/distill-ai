import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Extraction } from './entities/extraction.entity';
import { ExtractionActions } from './actions/extraction.actions';

@Module({
  imports: [TypeOrmModule.forFeature([Extraction])],
  providers: [ExtractionActions],
  exports: [ExtractionActions],
})
export class ExtractionModule {}
