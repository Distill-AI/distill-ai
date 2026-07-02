import { ApiProperty } from '@nestjs/swagger';
import { QuoteStatus } from '../enums/quote-status.enum';

/** Swagger schema for one priced line of a quote. */
export class QuoteLineDetailResponseDto {
  @ApiProperty({ example: 1 })
  position: number;

  @ApiProperty({ nullable: true, format: 'uuid' })
  sku_id: string | null;

  @ApiProperty({ example: 'M6 Hex Bolt' })
  description: string;

  @ApiProperty({ example: 100 })
  quantity: number;

  @ApiProperty({ example: 950, description: 'Minor units' })
  unit_price_minor: number;

  @ApiProperty({ example: 95000, description: 'Minor units' })
  amount_minor: number;
}

/** Swagger schema for the quote detail shared by GET /requests/:id and POST /requests/:id/quote. */
export class QuoteDetailResponseDto {
  @ApiProperty({ example: 'Q-2026-00042' })
  quote_number: string;

  @ApiProperty({ enum: QuoteStatus, example: QuoteStatus.READY })
  status: QuoteStatus;

  @ApiProperty({ example: 100000, description: 'Minor units' })
  subtotal_minor: number;

  @ApiProperty({ example: 5000, description: 'Minor units' })
  discount_minor: number;

  @ApiProperty({ example: 95000, description: 'Minor units' })
  total_minor: number;

  @ApiProperty({ example: 'NGN' })
  currency: string;

  @ApiProperty({ nullable: true, example: 3 })
  lead_time_days: number | null;

  @ApiProperty({ nullable: true, example: 'quotes/org-1/quote-1.pdf' })
  pdf_storage_url: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  pdf_generated_at: Date | null;

  @ApiProperty({ nullable: true, example: 'Your quote from Acme Corp' })
  email_draft_subject: string | null;

  @ApiProperty({ nullable: true, example: 'Hi Dana, please find your quote attached...' })
  email_draft_body: string | null;

  @ApiProperty({ type: [QuoteLineDetailResponseDto] })
  lines: QuoteLineDetailResponseDto[];
}

/** Swagger schema for the POST /requests/:id/quote response envelope. */
export class ApproveQuoteResponseDto {
  @ApiProperty({ type: QuoteDetailResponseDto })
  quote: QuoteDetailResponseDto;
}
