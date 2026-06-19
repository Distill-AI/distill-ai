import { Module } from '@nestjs/common';
import { RequestsModule } from '@modules/requests/requests.module';
import { EventsModule } from '@modules/events/events.module';
import { PipelineGraphEngine } from '@modules/pipeline/graph.engine';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { STUB_NODES } from '@modules/pipeline/stub-nodes';
import { QueueClientModule } from './queue-client.module';
import { PipelineProcessor } from './processors/pipeline.processor';

/**
 * Worker-process module for the pipeline: the graph engine, the node registry + (M1) stub nodes,
 * and the Bull processor that drives a run per request. Imported only by WorkerModule, so the
 * processor never runs in the API process. Stub nodes register themselves with NodeRegistry on
 * construction (Nest instantiates providers eagerly).
 */
@Module({
  imports: [QueueClientModule, RequestsModule, EventsModule],
  providers: [PipelineGraphEngine, NodeRegistry, ...STUB_NODES, PipelineProcessor],
})
export class PipelineQueueModule {}
