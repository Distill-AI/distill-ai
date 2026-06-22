export class ClassifyResponseDto {
  type!: 'catalog_rfq' | 'service_quote';
  confidence!: number;
}
