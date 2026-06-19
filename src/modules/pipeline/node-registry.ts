import { Injectable } from '@nestjs/common';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import type { PipelineNode } from './types';

/**
 * Indexes pipeline nodes by their `CurrentNode` name so the engine can look up the
 * implementation for whatever node a request is currently checkpointed at. Nodes register
 * themselves from their constructor (they receive this registry via DI).
 */
@Injectable()
export class NodeRegistry {
  private readonly nodes = new Map<CurrentNode, PipelineNode>();

  /** Register a node. Last registration for a given name wins. */
  register(node: PipelineNode): void {
    this.nodes.set(node.name, node);
  }

  /** Resolve the node for a name, or throw if none is registered (a wiring bug). */
  get(name: CurrentNode): PipelineNode {
    const node = this.nodes.get(name);
    if (!node) {
      throw new Error(`No pipeline node registered for "${name}"`);
    }
    return node;
  }

  /** True if a node is registered for the name. */
  has(name: CurrentNode): boolean {
    return this.nodes.has(name);
  }
}
