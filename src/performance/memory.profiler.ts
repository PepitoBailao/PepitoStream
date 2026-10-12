import { Injectable, Logger } from '@nestjs/common';

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

interface MemoryLeak {
  name: string;
  pattern: string;
  growthRate: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface MemoryReport {
  current: MemorySnapshot;
  peak: MemorySnapshot;
  average: Partial<MemorySnapshot>;
  leaks: MemoryLeak[];
  trends: {
    heapGrowth: number;
    externalGrowth: number;
    rssGrowth: number;
  };
}

@Injectable()
export class MemoryProfiler {
  private readonly logger = new Logger(MemoryProfiler.name);
  private snapshots: MemorySnapshot[] = [];
  private maxSnapshots = 100;
  private leakThreshold = 0.1; // 10% growth per snapshot

  /**
   * Take memory snapshot
   */
  takeSnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    };

    this.snapshots.push(snapshot);
    this.maintainSnapshots();

    return snapshot;
  }

  /**
   * Get memory report with leak detection
   */
  getMemoryReport(): MemoryReport {
    if (this.snapshots.length < 2) {
      this.logger.warn('Not enough snapshots for analysis');
      return this.getEmptyReport();
    }

    const current = this.snapshots[this.snapshots.length - 1];
    const peak = this.snapshots.reduce((max, snap) => 
      snap.heapUsed > max.heapUsed ? snap : max
    );

    const average = this.calculateAverage();
    const leaks = this.detectLeaks();
    const trends = this.calculateTrends();

    return { current, peak, average, leaks, trends };
  }

  /**
   * Monitor memory growth
   */
  monitorMemoryGrowth(interval: number = 5000): NodeJS.Timer {
    return setInterval(() => {
      const snapshot = this.takeSnapshot();
      const heapMB = (snapshot.heapUsed / 1024 / 1024).toFixed(2);
      const rssMB = (snapshot.rss / 1024 / 1024).toFixed(2);

      this.logger.debug(`Memory: Heap ${heapMB}MB, RSS ${rssMB}MB`);

      const report = this.getMemoryReport();
      if (report.leaks.length > 0) {
        this.logger.warn(`Potential memory leaks detected: ${report.leaks.map(l => l.name).join(', ')}`);
      }
    }, interval);
  }

  /**
   * Detect memory leaks based on growth patterns
   */
  private detectLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];

    if (this.snapshots.length < 5) return leaks;

    // Analyze heap growth
    const heapGrowthRate = this.calculateGrowthRate(
      this.snapshots.map(s => s.heapUsed)
    );

    if (heapGrowthRate > this.leakThreshold) {
      leaks.push({
        name: 'Heap Memory Leak',
        pattern: 'Consistent heap growth detected',
        growthRate: heapGrowthRate,
        severity: this.getSeverity(heapGrowthRate)
      });
    }

    // Analyze external memory
    const externalGrowthRate = this.calculateGrowthRate(
      this.snapshots.map(s => s.external)
    );

    if (externalGrowthRate > this.leakThreshold) {
      leaks.push({
        name: 'External Memory Leak',
        pattern: 'Native memory growth detected',
        growthRate: externalGrowthRate,
        severity: this.getSeverity(externalGrowthRate)
      });
    }

    // Analyze RSS growth
    const rssGrowthRate = this.calculateGrowthRate(
      this.snapshots.map(s => s.rss)
    );

    if (rssGrowthRate > this.leakThreshold * 2) {
      leaks.push({
        name: 'RSS Memory Leak',
        pattern: 'Resident set growth detected',
        growthRate: rssGrowthRate,
        severity: this.getSeverity(rssGrowthRate)
      });
    }

    return leaks;
  }

  /**
   * Calculate growth rate using linear regression
   */
  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    const numerator = x.reduce((sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean), 0);
    const denominator = x.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0);

    if (denominator === 0) return 0;

    const slope = numerator / denominator;
    const percentageGrowth = (slope / yMean) * 100;

    return Math.max(0, percentageGrowth);
  }

  /**
   * Get memory usage as percentage
   */
  getMemoryUsagePercent(): number {
    const mem = process.memoryUsage();
    const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;
    return Math.round(heapPercent);
  }

  /**
   * Force garbage collection (if exposed)
   */
  forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      this.logger.log('Garbage collection triggered');
      const after = this.takeSnapshot();
      this.logger.log(`Heap after GC: ${(after.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    } else {
      this.logger.warn('Garbage collection not exposed. Run with --expose-gc flag');
    }
  }

  /**
   * Get memory timeline
   */
  getTimeline(): Array<{ time: string; heap: number; rss: number }> {
    return this.snapshots.map(snap => ({
      time: new Date(snap.timestamp).toISOString(),
      heap: Math.round(snap.heapUsed / 1024 / 1024), // MB
      rss: Math.round(snap.rss / 1024 / 1024) // MB
    }));
  }

  /**
   * Clear snapshots
   */
  clearSnapshots(): void {
    this.snapshots = [];
    this.logger.log('Memory snapshots cleared');
  }

  // Private helpers
  private calculateAverage(): Partial<MemorySnapshot> {
    if (this.snapshots.length === 0) return {};

    const avg = {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0
    };

    this.snapshots.forEach(snap => {
      avg.heapUsed += snap.heapUsed;
      avg.heapTotal += snap.heapTotal;
      avg.external += snap.external;
      avg.rss += snap.rss;
    });

    const count = this.snapshots.length;
    return {
      heapUsed: avg.heapUsed / count,
      heapTotal: avg.heapTotal / count,
      external: avg.external / count,
      rss: avg.rss / count
    };
  }

  private calculateTrends(): { heapGrowth: number; externalGrowth: number; rssGrowth: number } {
    if (this.snapshots.length < 2) {
      return { heapGrowth: 0, externalGrowth: 0, rssGrowth: 0 };
    }

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];

    return {
      heapGrowth: ((last.heapUsed - first.heapUsed) / first.heapUsed) * 100,
      externalGrowth: ((last.external - first.external) / (first.external || 1)) * 100,
      rssGrowth: ((last.rss - first.rss) / first.rss) * 100
    };
  }

  private getSeverity(growthRate: number): 'low' | 'medium' | 'high' | 'critical' {
    if (growthRate > 50) return 'critical';
    if (growthRate > 30) return 'high';
    if (growthRate > 20) return 'medium';
    return 'low';
  }

  private maintainSnapshots(): void {
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }
  }

  private getEmptyReport(): MemoryReport {
    const emptySnapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0
    };

    return {
      current: emptySnapshot,
      peak: emptySnapshot,
      average: {},
      leaks: [],
      trends: { heapGrowth: 0, externalGrowth: 0, rssGrowth: 0 }
    };
  }
}
