import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import * as SYS_MSG from '@constants/system-messages';
import { scoringConfig } from '@config/scoring.config';

const autoThresholdSchema = z.coerce.number().min(0).max(1);
const autoSendCapSchema = z.coerce.number().int().nonnegative();

@Injectable()
export class ScoringConfigService {
  private readonly logger = new Logger(ScoringConfigService.name);
  private lastValidAutoThreshold = scoringConfig.autoThreshold;
  private lastValidAutoSendCapMinor = scoringConfig.autoSendCapMinor;

  constructor(private readonly config: ConfigService) {}

  /** Reads SCORE_AUTO_THRESHOLD at decision time; retains the last valid value when the current config is malformed or out of range. */
  getAutoThreshold(): number {
    const raw = this.config.get('SCORE_AUTO_THRESHOLD');
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (value === undefined || value === null || value === '') {
      this.lastValidAutoThreshold = scoringConfig.autoThreshold;
      return scoringConfig.autoThreshold;
    }

    const parsed = autoThresholdSchema.safeParse(value);
    if (parsed.success) {
      this.lastValidAutoThreshold = parsed.data;
      return parsed.data;
    }

    this.logger.warn(SYS_MSG.SCORE_INVALID_AUTO_THRESHOLD(raw, this.lastValidAutoThreshold));
    return this.lastValidAutoThreshold;
  }

  /** Reads SCORE_AUTO_SEND_CAP_MINOR at decision time; an unset value means no cap, and a malformed value retains the last valid value. */
  getAutoSendCapMinor(): number | undefined {
    const raw = this.config.get('SCORE_AUTO_SEND_CAP_MINOR');
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (value === undefined || value === null || value === '') {
      this.lastValidAutoSendCapMinor = undefined;
      return undefined;
    }

    const parsed = autoSendCapSchema.safeParse(value);
    if (parsed.success) {
      this.lastValidAutoSendCapMinor = parsed.data;
      return parsed.data;
    }

    this.logger.warn(SYS_MSG.SCORE_INVALID_AUTO_SEND_CAP(raw, this.lastValidAutoSendCapMinor));
    return this.lastValidAutoSendCapMinor;
  }
}
