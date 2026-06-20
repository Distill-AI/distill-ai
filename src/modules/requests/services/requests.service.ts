import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestModelAction } from '../requests.model-action';
import type { Request } from '../entities/request.entity';
import * as SYS_MSG from '@constants/system-messages';

@Injectable()
export class RequestsService {
  constructor(private readonly modelAction: RequestModelAction) {}

  async findById(requestId: string): Promise<Request | null> {
    return this.modelAction.get({ identifierOptions: { id: requestId } });
  }

  async findByIdOrFail(requestId: string): Promise<Request> {
    const req = await this.findById(requestId);
    if (!req) {
      throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
    }
    return req;
  }
}
