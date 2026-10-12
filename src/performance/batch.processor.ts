import { Injectable, Logger } from '@nestjs/common';

interface BatchJob<T, R> {
  id: string;
  items: T[];
  processor: (items: T[]) => Promise<R[]>;
  batchSize: number;
  timeout: number;
  retries: number;
  priority: number;
}

interface BatchResult<R> {
  results: R[];
  processed: number;
  failed: number;
  duration: number;
  errors: string[];
}

@Injectable()
export class BatchProcessor {
  private readonly logger = new Logger(BatchProcessor.name);
  private queue: Map<string, BatchJob<any, any>> = new Map();
  private results: Map<string, BatchResult<any>> = new Map();
  private processing = false;
  private batchInterval = 100; // ms

  /**
   * Add job to batch queue
   */
  addJob<T, R>(
    items: T[],
    processor: (items: T[]) => Promise<R[]>,
    options: Partial<BatchJob<T, R>> = {}
  ): string {
    const jobId = this.generateJobId();
    
    const job: BatchJob<T, R> = {
      id: jobId,
      items,
      processor,
      batchSize: options.batchSize || 100,
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      priority: options.priority || 0
    };

    this.queue.set(jobId, job);
    this.logger.log(`Job ${jobId} added to queue (${items.length} items)`);

    return jobId;
  }

  /**
   * Process all queued jobs
   */
  async processQueue(): Promise<Map<string, BatchResult<any>>> {
    if (this.processing) {
      this.logger.warn('Already processing queue');
      return this.results;
    }

    this.processing = true;
    const sortedJobs = Array.from(this.queue.values()).sort((a, b) => b.priority - a.priority);

    for (const job of sortedJobs) {
      const result = await this.processJob(job);
      this.results.set(job.id, result);
    }

    this.queue.clear();
    this.processing = false;

    return this.results;
  }

  /**
   * Process single job with retry logic
   */
  async processJob<T, R>(job: BatchJob<T, R>): Promise<BatchResult<R>> {
    const startTime = performance.now();
    const results: R[] = [];
    const errors: string[] = [];
    let processed = 0;
    let failed = 0;

    const batches = this.createBatches(job.items, job.batchSize);

    for (let attempt = 0; attempt < job.retries; attempt++) {
      for (const batch of batches) {
        try {
          const batchResults = await Promise.race([
            job.processor(batch),
            this.timeout(job.timeout)
          ]) as R[];

          results.push(...batchResults);
          processed += batch.length;
        } catch (error) {
          failed += batch.length;
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Batch failed (attempt ${attempt + 1}): ${errorMsg}`);
          this.logger.error(`Job ${job.id} batch failed: ${errorMsg}`);

          if (attempt < job.retries - 1) {
            await this.delay(Math.pow(2, attempt) * 100); // Exponential backoff
          }
        }

        await this.delay(this.batchInterval);
      }

      if (errors.length === 0) break;
    }

    const duration = performance.now() - startTime;

    return {
      results,
      processed,
      failed,
      duration,
      errors
    };
  }

  /**
   * Get job result
   */
  getResult<R>(jobId: string): BatchResult<R> | undefined {
    return this.results.get(jobId);
  }

  /**
   * Parallel batch processing
   */
  async parallelBatch<T, R>(
    items: T[],
    processor: (items: T[]) => Promise<R[]>,
    concurrency: number = 5,
    batchSize: number = 100
  ): Promise<BatchResult<R>> {
    const startTime = performance.now();
    const batches = this.createBatches(items, batchSize);
    const results: R[] = [];
    const errors: string[] = [];
    let processed = 0;
    let failed = 0;

    // Process batches in parallel with concurrency limit
    for (let i = 0; i < batches.length; i += concurrency) {
      const concurrentBatches = batches.slice(i, i + concurrency);
      const promises = concurrentBatches.map(batch =>
        processor(batch)
          .then(result => {
            results.push(...result);
            processed += batch.length;
            return result;
          })
          .catch(error => {
            failed += batch.length;
            errors.push(error instanceof Error ? error.message : String(error));
            return [];
          })
      );

      await Promise.all(promises);
    }

    const duration = performance.now() - startTime;

    return {
      results,
      processed,
      failed,
      duration,
      errors
    };
  }

  /**
   * Stream batch processing for large datasets
   */
  async *streamBatch<T, R>(
    items: T[],
    processor: (items: T[]) => Promise<R[]>,
    batchSize: number = 100
  ): AsyncGenerator<R[], void, unknown> {
    const batches = this.createBatches(items, batchSize);

    for (const batch of batches) {
      const results = await processor(batch);
      yield results;
      await this.delay(this.batchInterval);
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    totalJobs: number;
    totalItems: number;
    processing: boolean;
    completedJobs: number;
  } {
    const totalItems = Array.from(this.queue.values()).reduce((sum, job) => sum + job.items.length, 0);
    
    return {
      totalJobs: this.queue.size,
      totalItems,
      processing: this.processing,
      completedJobs: this.results.size
    };
  }

  /**
   * Clear queue and results
   */
  clear(): void {
    this.queue.clear();
    this.results.clear();
    this.logger.log('Queue and results cleared');
  }

  /**
   * Set batch processing interval
   */
  setBatchInterval(interval: number): void {
    this.batchInterval = interval;
    this.logger.log(`Batch interval set to ${interval}ms`);
  }

  // Private helpers
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    );
  }
}
