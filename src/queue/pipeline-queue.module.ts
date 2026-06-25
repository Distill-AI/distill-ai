import { Module } from '@nestjs/common';
import { ObjectStoreModule } from '@common/object-store/object-store.module';
import { RequestsModule } from '@modules/requests/requests.module';
import { EventsModule } from '@modules/events/events.module';
import { PipelineEngineModule } from '@modules/pipeline/pipeline-engine.module';
import { PipelineGraphEngine } from '@modules/pipeline/graph.engine';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { STUB_NODES } from '@modules/pipeline/stub-nodes';
import { ClassifyModule } from '@modules/classify/classify.module';
import { ClassifyNode } from '@modules/classify/classify.node';
import { ExtractionModule } from '@modules/extraction/extraction.module';
import { ExtractNode } from '@modules/extraction/extract.node';
import { ScoringModule } from '@modules/scoring/scoring.module';
import { ScoreNode } from '@modules/scoring/score.node';
import { ToolsModule } from '@modules/tools/tools.module';
import { CatalogModule } from '@modules/catalog/catalog.module';
import { MatchNode } from '@modules/catalog/match.node';
import { ParseNode } from '@modules/parse/parse.node';
import { QueueClientModule } from './queue-client.module';
import { PipelineProcessor } from './processors/pipeline.processor';

/**
 * Worker-process module for the pipeline: the graph engine, the node registry, the real nodes
 * (ParseNode, ExtractNode, ClassifyNode, ScoreNode) + the remaining (M1) stub nodes, and the Bull
 * processor that drives a
 * run per request. Imported only by WorkerModule, so the processor never runs in the API process.
 * Nodes register themselves with NodeRegistry on construction (Nest instantiates providers eagerly).
 */
@Module({
  imports: [
    QueueClientModule,
    RequestsModule,
    EventsModule,
    PipelineEngineModule,
    ClassifyModule,
    ExtractionModule,
    ScoringModule,
    ToolsModule,
    CatalogModule,
    ObjectStoreModule,
  ],
  providers: [
    PipelineGraphEngine,
    NodeRegistry,
    ...STUB_NODES,
    ParseNode,
    ExtractNode,
    ClassifyNode,
    MatchNode,
    ScoreNode,
    PipelineProcessor,
  ],
  exports: [PipelineEngineModule],
})
export class PipelineQueueModule {}
