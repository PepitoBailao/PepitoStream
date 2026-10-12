import { Module } from '@nestjs/common';
import { QueryOptimizer } from './query.optimizer';
import { MemoryProfiler } from './memory.profiler';
import { BatchProcessor } from './batch.processor';
import { CDNOptimizer } from './cdn.optimizer';
import { PerformanceController } from './performance.controller';

@Module({
  providers: [
    QueryOptimizer,
    MemoryProfiler,
    BatchProcessor,
    CDNOptimizer
  ],
  controllers: [PerformanceController],
  exports: [
    QueryOptimizer,
    MemoryProfiler,
    BatchProcessor,
    CDNOptimizer
  ]
})
export class PerformanceModule {}
