import { Injectable } from '@nestjs/common';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { NodeRegistry } from './node-registry';
import type { NodeResult, PipelineNode } from './types';

/**
 * M1 stub nodes. They prove the engine's loop, between-node checkpointing, and crash resume
 * end to end before the real nodes (parse/extract/classify/match/price/policy/score) land in M2.
 * Each advances to the next node in the graph; `score` advances to `done`. No DB writes, no LLM.
 *
 * Each node registers itself with the NodeRegistry from its constructor (fields are initialized
 * before the constructor body runs, so `name`/`nextNode` are set when `register` is called).
 */

@Injectable()
export class ClassifyStubNode implements PipelineNode {
  readonly name = CurrentNode.CLASSIFY;
  private readonly nextNode = CurrentNode.MATCH;
  constructor(registry: NodeRegistry) {
    registry.register(this);
  }
  run(): Promise<NodeResult> {
    return Promise.resolve({ kind: 'advance', next: this.nextNode });
  }
}

@Injectable()
export class MatchStubNode implements PipelineNode {
  readonly name = CurrentNode.MATCH;
  private readonly nextNode = CurrentNode.PRICE;
  constructor(registry: NodeRegistry) {
    registry.register(this);
  }
  run(): Promise<NodeResult> {
    return Promise.resolve({ kind: 'advance', next: this.nextNode });
  }
}

@Injectable()
export class PriceStubNode implements PipelineNode {
  readonly name = CurrentNode.PRICE;
  private readonly nextNode = CurrentNode.POLICY;
  constructor(registry: NodeRegistry) {
    registry.register(this);
  }
  run(): Promise<NodeResult> {
    return Promise.resolve({ kind: 'advance', next: this.nextNode });
  }
}

@Injectable()
export class PolicyStubNode implements PipelineNode {
  readonly name = CurrentNode.POLICY;
  private readonly nextNode = CurrentNode.SCORE;
  constructor(registry: NodeRegistry) {
    registry.register(this);
  }
  run(): Promise<NodeResult> {
    return Promise.resolve({ kind: 'advance', next: this.nextNode });
  }
}

/** All stub-node providers, for registration in the module. */
export const STUB_NODES = [MatchStubNode, PriceStubNode, PolicyStubNode];
