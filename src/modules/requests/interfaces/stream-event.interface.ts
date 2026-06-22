import { StreamNode } from '../enums/stream-node.enum';
import { StreamToolStatus } from '../enums/stream-tool-status.enum';
import { NodeExitStatus } from '../enums/node-exit-status.enum';

export interface StreamEvent {
  timestamp: string;
}

export interface NodeEnteredEvent extends StreamEvent {
  type: 'node.entered';
  node: StreamNode;
  status: 'processing';
}

export interface NodeExitedEvent extends StreamEvent {
  type: 'node.exited';
  node: StreamNode;
  status: NodeExitStatus;
  duration_ms: number;
  summary: string;
}

export interface ToolInvokedEvent extends StreamEvent {
  type: 'tool.invoked';
  node: StreamNode.EXTRACT | StreamNode.MATCH;
  tool_name: string;
  status: StreamToolStatus;
  attempt: number;
  result_summary: string;
}

export interface ProcessingCompleteEvent extends StreamEvent {
  type: 'processing.complete';
  status: NodeExitStatus;
  total_duration_ms: number;
}

export type ProcessingTraceEvent =
  | NodeEnteredEvent
  | NodeExitedEvent
  | ToolInvokedEvent
  | ProcessingCompleteEvent;
