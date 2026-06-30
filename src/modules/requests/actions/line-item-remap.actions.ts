import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { LineItem } from '@modules/catalog/entities/line-item.entity';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import { Sku } from '@modules/catalog/entities/sku.entity';
import {
  QuoteRecomputeService,
  MANUAL_OVERRIDE_FLAG,
} from '@modules/pricing/quote-recompute.service';
import * as SYS_MSG from '@constants/system-messages';
import { Request } from '../entities/request.entity';
import { RequestStatus } from '../enums/request-status.enum';
import type { PatchLineItemDto } from '../dto/patch-line-item.dto';
import type { RemapResponsePayload } from '../interfaces/remap.interface';

const CLOSE_TIE_FLAG = 'close_tie';

/**
 * Persists an estimator's re-map of one line and re-prices the request deterministically
 * (US-E6-2-BE). The request is already org-resolved by the controller; this re-validates that the
 * line and any chosen SKU belong to that org, returning 404 without enumeration (SEC-01). The line
 * update, recompute, and any needs_review transition run in one transaction so they cannot diverge.
 */
@Injectable()
export class LineItemRemapActions {
  constructor(
    private readonly lineItems: LineItemModelAction,
    @InjectRepository(Sku) private readonly skus: Repository<Sku>,
    private readonly recompute: QuoteRecomputeService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async remap(
    request: Request,
    lineId: string,
    dto: PatchLineItemDto,
  ): Promise<RemapResponsePayload> {
    if (
      dto.sku_id === undefined &&
      dto.quantity === undefined &&
      dto.unit_price_minor === undefined &&
      dto.override === undefined
    ) {
      throw new CustomHttpException(SYS_MSG.REMAP_NOTHING_TO_UPDATE, HttpStatus.BAD_REQUEST);
    }

    const line = await this.lineItems.get({ identifierOptions: { id: lineId } });
    if (!line || line.request_id !== request.id) {
      throw new CustomHttpException(SYS_MSG.REMAP_LINE_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    if (dto.sku_id !== undefined) {
      const sku = await this.skus.findOne({ where: { id: dto.sku_id, org_id: request.org_id } });
      if (!sku) {
        // 404 (not 403) with a neutral message so a cross-org id is not confirmed to exist (SEC-01).
        throw new CustomHttpException(SYS_MSG.REMAP_SKU_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
    }

    // override locks the line to a manual price, so it must have one (in this body or already persisted).
    if (
      dto.override === true &&
      dto.unit_price_minor === undefined &&
      line.unit_price_minor === null
    ) {
      throw new CustomHttpException(SYS_MSG.REMAP_OVERRIDE_PRICE_REQUIRED, HttpStatus.BAD_REQUEST);
    }

    // A manual price with override:false is contradictory (set a price, then disable the override
    // that would keep it); reject it rather than persisting a price recompute would overwrite.
    if (dto.override === false && dto.unit_price_minor !== undefined) {
      throw new CustomHttpException(SYS_MSG.REMAP_OVERRIDE_CONFLICT, HttpStatus.BAD_REQUEST);
    }

    const totals = await this.dataSource.transaction(async (em) => {
      await em.update(LineItem, { id: lineId }, this.buildUpdate(line, dto));
      const result = await this.recompute.recompute(request.id, request.org_id, em);
      // EC-04: a re-map onto a SKU with no applicable pricing rule blocks auto-send -> needs_review.
      if (result.blocked) {
        await em.update(Request, { id: request.id }, { status: RequestStatus.NEEDS_REVIEW });
      }
      return result;
    });

    const updated = await this.lineItems.get({ identifierOptions: { id: lineId } });
    return {
      request_id: request.id,
      line: {
        id: lineId,
        matched_sku_id: updated?.matched_sku_id ?? null,
        quantity: updated?.quantity ?? null,
        unit_price_minor: updated?.unit_price_minor ?? null,
        match_confidence: updated?.match_confidence ?? null,
      },
      quote: {
        quote_id: totals.quoteId,
        subtotal_minor: totals.subtotalMinor,
        discount_minor: totals.discountMinor,
        total_minor: totals.totalMinor,
        lead_time_days: totals.leadTimeDays,
        blocked: totals.blocked,
      },
    };
  }

  /**
   * Builds the line update: a confirmed re-map is 100% and no longer a close tie. A supplied manual
   * price is always persisted and, since a manual price is by definition an override, marks the line
   * overridden so recompute keeps it; an explicit `override: false` clears that flag.
   */
  private buildUpdate(line: LineItem, dto: PatchLineItemDto): QueryDeepPartialEntity<LineItem> {
    const flags = new Set(Array.isArray(line.flags) ? (line.flags as string[]) : []);
    const update: QueryDeepPartialEntity<LineItem> = {};

    if (dto.sku_id !== undefined) {
      update.matched_sku_id = dto.sku_id;
      update.match_confidence = 1;
      flags.delete(CLOSE_TIE_FLAG);
    }
    if (dto.quantity !== undefined) {
      update.quantity = dto.quantity;
    }
    if (dto.unit_price_minor !== undefined) {
      update.unit_price_minor = dto.unit_price_minor;
    }

    if (dto.override === false) {
      flags.delete(MANUAL_OVERRIDE_FLAG);
    } else if (dto.override === true || dto.unit_price_minor !== undefined) {
      flags.add(MANUAL_OVERRIDE_FLAG);
    }

    update.flags = [...flags] as unknown as object[];
    return update;
  }
}
