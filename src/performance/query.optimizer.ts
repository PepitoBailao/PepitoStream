import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

interface QueryPlan {
  sql: string;
  estimatedRows: number;
  estimatedCost: number;
  indexes: string[];
  optimizations: string[];
}

interface QueryMetrics {
  executionTime: number;
  rowsScanned: number;
  rowsReturned: number;
  cacheHit: boolean;
  queryPlan: QueryPlan;
}

@Injectable()
export class QueryOptimizer {
  private readonly logger = new Logger(QueryOptimizer.name);
  private queryCache = new Map<string, QueryMetrics>();
  private slowQueryThreshold = 100; // ms

  /**
   * Analyze and optimize database queries
   */
  async analyzeQuery(query: SelectQueryBuilder<any>): Promise<QueryPlan> {
    const sql = query.getSql();
    const parameters = query.getParameters();

    const plan: QueryPlan = {
      sql,
      estimatedRows: 0,
      estimatedCost: 0,
      indexes: [],
      optimizations: []
    };

    // Detect missing indexes
    plan.indexes = this.detectMissingIndexes(sql);
    
    // Suggest optimizations
    plan.optimizations = this.suggestOptimizations(sql, parameters);
    
    // Estimate query cost
    plan.estimatedCost = this.estimateQueryCost(sql, plan.indexes.length);
    plan.estimatedRows = this.estimateRowsAffected(sql);

    return plan;
  }

  /**
   * Execute query with metrics tracking
   */
  async executeWithMetrics<T>(
    query: SelectQueryBuilder<T>
  ): Promise<{ data: T[]; metrics: QueryMetrics }> {
    const startTime = performance.now();
    const sql = query.getSql();
    const cacheKey = this.generateCacheKey(sql, query.getParameters());

    // Check cache
    if (this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey);
      cached.cacheHit = true;
      return { data: [] as T[], metrics: cached };
    }

    try {
      const data = await query.getMany();
      const executionTime = performance.now() - startTime;

      // Warn if slow query
      if (executionTime > this.slowQueryThreshold) {
        this.logger.warn(`Slow query detected: ${executionTime.toFixed(2)}ms - ${sql.substring(0, 100)}`);
      }

      // Get query plan
      const plan = await this.analyzeQuery(query);

      const metrics: QueryMetrics = {
        executionTime,
        rowsScanned: data.length * 2, // Estimate
        rowsReturned: data.length,
        cacheHit: false,
        queryPlan: plan
      };

      // Cache metrics
      this.queryCache.set(cacheKey, metrics);
      this.cleanupCache();

      return { data, metrics };
    } catch (error) {
      this.logger.error(`Query execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Batch queries for better performance
   */
  async batchQueries<T>(
    queries: SelectQueryBuilder<T>[],
    batchSize: number = 5
  ): Promise<{ data: T[][]; metrics: QueryMetrics[] }> {
    const results: T[][] = [];
    const metrics: QueryMetrics[] = [];

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchPromises = batch.map(q => this.executeWithMetrics(q));
      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach(result => {
        results.push(result.data);
        metrics.push(result.metrics);
      });
    }

    return { data: results, metrics };
  }

  /**
   * Detect N+1 query problems
   */
  detectNPlusOne(queries: string[]): { hasNPlusOne: boolean; analysis: string } {
    const queryPatterns = new Map<string, number>();

    queries.forEach(query => {
      const pattern = this.normalizeQuery(query);
      queryPatterns.set(pattern, (queryPatterns.get(pattern) || 0) + 1);
    });

    let analysis = '';
    let hasNPlusOne = false;

    queryPatterns.forEach((count, pattern) => {
      if (count > 10) {
        hasNPlusOne = true;
        analysis += `Pattern "${pattern.substring(0, 50)}..." executed ${count} times\n`;
      }
    });

    return { hasNPlusOne, analysis };
  }

  /**
   * Suggest index creation
   */
  suggestIndexes(sql: string): string[] {
    const suggestions: string[] = [];

    // Detect WHERE clauses without indexes
    if (sql.match(/WHERE\s+(\w+)\s*=/i)) {
      const columns = sql.match(/WHERE\s+(\w+)\s*=/gi) || [];
      columns.forEach(col => {
        const match = col.match(/WHERE\s+(\w+)/i);
        if (match) {
          suggestions.push(`CREATE INDEX idx_${match[1]} ON table_name(${match[1]})`);
        }
      });
    }

    // Detect JOIN clauses that might benefit from indexes
    if (sql.match(/JOIN.*ON\s+(\w+\.\w+)/i)) {
      const joins = sql.match(/JOIN.*ON\s+(\w+\.\w+)/gi) || [];
      joins.forEach(join => {
        suggestions.push(`Consider adding index on JOIN columns: ${join}`);
      });
    }

    return suggestions;
  }

  /**
   * Get query statistics
   */
  getQueryStats(): {
    totalQueries: number;
    avgExecutionTime: number;
    cacheHitRate: number;
    slowQueries: number;
  } {
    const metrics = Array.from(this.queryCache.values());
    const totalQueries = metrics.length;
    const cacheHits = metrics.filter(m => m.cacheHit).length;
    const slowQueries = metrics.filter(m => m.executionTime > this.slowQueryThreshold).length;
    const avgExecutionTime = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries
      : 0;

    return {
      totalQueries,
      avgExecutionTime,
      cacheHitRate: totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0,
      slowQueries
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.queryCache.clear();
    this.logger.log('Query optimizer statistics reset');
  }

  // Private helpers
  private detectMissingIndexes(sql: string): string[] {
    const indexes: string[] = [];
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:GROUP|ORDER|LIMIT|$)/i);

    if (whereMatch) {
      const conditions = whereMatch[1].split(/AND|OR/i);
      conditions.forEach(cond => {
        const columnMatch = cond.match(/(\w+)\s*=/);
        if (columnMatch) {
          indexes.push(`idx_${columnMatch[1]}`);
        }
      });
    }

    return [...new Set(indexes)]; // Remove duplicates
  }

  private suggestOptimizations(sql: string, parameters: any[]): string[] {
    const optimizations: string[] = [];

    if (sql.includes('SELECT *')) {
      optimizations.push('Avoid SELECT * - specify needed columns');
    }

    if (sql.match(/WHERE.*OR.*OR.*OR/i)) {
      optimizations.push('Consider using IN clause instead of multiple OR conditions');
    }

    if (sql.match(/JOIN.*JOIN.*JOIN/i)) {
      optimizations.push('Multiple JOINs detected - consider using subqueries');
    }

    if (sql.includes('LIKE %')) {
      optimizations.push('LIKE with leading wildcard is not index-friendly');
    }

    if (!sql.includes('LIMIT') && sql.includes('SELECT')) {
      optimizations.push('Consider adding LIMIT for large result sets');
    }

    return optimizations;
  }

  private estimateQueryCost(sql: string, indexCount: number): number {
    let cost = 100;

    if (sql.includes('JOIN')) cost += 50;
    if (sql.includes('GROUP BY')) cost += 30;
    if (sql.includes('ORDER BY')) cost += 20;
    if (sql.includes('SUBQUERY')) cost += 40;

    cost -= indexCount * 10; // Reduce cost with indexes

    return Math.max(1, cost);
  }

  private estimateRowsAffected(sql: string): number {
    if (sql.includes('LIMIT')) {
      const match = sql.match(/LIMIT\s+(\d+)/i);
      if (match) return parseInt(match[1], 10);
    }
    return 1000; // Default estimate
  }

  private normalizeQuery(sql: string): string {
    return sql
      .replace(/\d+/g, '?')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }

  private generateCacheKey(sql: string, parameters: any[]): string {
    const key = `${sql}:${JSON.stringify(parameters)}`;
    return require('crypto')
      .createHash('md5')
      .update(key)
      .digest('hex');
  }

  private cleanupCache(): void {
    if (this.queryCache.size > 10000) {
      const entries = Array.from(this.queryCache.entries());
      const toDelete = entries
        .sort((a, b) => b[1].executionTime - a[1].executionTime)
        .slice(5000);

      toDelete.forEach(([key]) => this.queryCache.delete(key));
    }
  }
}
