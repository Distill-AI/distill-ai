import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Extraction } from '../entities/extraction.entity';
import { ExtractionStatus } from '../enums/extraction-status.enum';

@Injectable()
export class ExtractionActions {
  constructor(
    @InjectRepository(Extraction)
    private readonly extractionRepository: Repository<Extraction>,
  ) {}

  async findValidExtraction(requestId: string): Promise<Extraction | null> {
    return this.extractionRepository.findOne({
      where: {
        request_id: requestId,
        status: ExtractionStatus.COMPLETED,
        schema_valid: true,
      },
      order: { created_at: 'DESC' },
    });
  }

  async hasValidExtraction(requestId: string): Promise<boolean> {
    const existing = await this.findValidExtraction(requestId);
    return existing !== null;
  }
}
