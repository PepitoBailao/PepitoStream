import { Injectable, Logger } from '@nestjs/common';
import * as zlib from 'zlib';
import * as brotli from 'brotli';

export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'brotli' | 'deflate';
  level: number; // 1-11 for brotli, 1-9 for gzip
  threshold: number; // bytes - minimum size to compress
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number; // milliseconds
  decompressionTime: number; // milliseconds
}

@Injectable()
export class CacheCompressionService {
  private readonly logger = new Logger(CacheCompressionService.name);
  private stats = {
    totalOriginal: 0,
    totalCompressed: 0,
    compressionAttempts: 0,
    successfulCompressions: 0,
  };

  constructor(private config: CompressionConfig) {}

  /**
   * Compress data
   */
  async compress(data: string | Buffer): Promise<{
    compressed: Buffer;
    stats: CompressionStats;
  }> {
    const startTime = performance.now();
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
    const originalSize = buffer.length;

    // Don't compress if below threshold
    if (originalSize < this.config.threshold) {
      return {
        compressed: buffer,
        stats: {
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 0,
          compressionTime: 0,
          decompressionTime: 0,
        },
      };
    }

    try {
      let compressed: Buffer;

      switch (this.config.algorithm) {
        case 'gzip':
          compressed = await this.gzipCompress(buffer);
          break;
        case 'brotli':
          compressed = await this.brotliCompress(buffer);
          break;
        case 'deflate':
          compressed = await this.deflateCompress(buffer);
          break;
        default:
          compressed = buffer;
      }

      const compressionTime = performance.now() - startTime;
      const compressedSize = compressed.length;
      const ratio =
        originalSize > 0 ? 1 - compressedSize / originalSize : 0;

      this.stats.totalOriginal += originalSize;
      this.stats.totalCompressed += compressedSize;
      this.stats.compressionAttempts++;
      if (ratio > 0.05) {
        this.stats.successfulCompressions++;
      }

      return {
        compressed,
        stats: {
          originalSize,
          compressedSize,
          compressionRatio: ratio,
          compressionTime,
          decompressionTime: 0,
        },
      };
    } catch (error) {
      this.logger.error(`Compression error: ${error}`);
      return {
        compressed: buffer,
        stats: {
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 0,
          compressionTime: performance.now() - startTime,
          decompressionTime: 0,
        },
      };
    }
  }

  /**
   * Decompress data
   */
  async decompress(buffer: Buffer): Promise<{
    decompressed: Buffer;
    time: number;
  }> {
    const startTime = performance.now();

    try {
      let decompressed: Buffer;

      switch (this.config.algorithm) {
        case 'gzip':
          decompressed = await this.gzipDecompress(buffer);
          break;
        case 'brotli':
          decompressed = await this.brotliDecompress(buffer);
          break;
        case 'deflate':
          decompressed = await this.deflateDecompress(buffer);
          break;
        default:
          decompressed = buffer;
      }

      const time = performance.now() - startTime;
      return { decompressed, time };
    } catch (error) {
      this.logger.error(`Decompression error: ${error}`);
      return {
        decompressed: buffer,
        time: performance.now() - startTime,
      };
    }
  }

  /**
   * Get compression statistics
   */
  getStats() {
    const overallRatio =
      this.stats.totalOriginal > 0
        ? 1 - this.stats.totalCompressed / this.stats.totalOriginal
        : 0;

    return {
      totalOriginalSize: this.stats.totalOriginal,
      totalCompressedSize: this.stats.totalCompressed,
      overallCompressionRatio: overallRatio,
      successRate:
        this.stats.compressionAttempts > 0
          ? this.stats.successfulCompressions /
            this.stats.compressionAttempts
          : 0,
      attempts: this.stats.compressionAttempts,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalOriginal: 0,
      totalCompressed: 0,
      compressionAttempts: 0,
      successfulCompressions: 0,
    };
  }

  /**
   * Private compression implementations
   */

  private gzipCompress(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(buffer, { level: this.config.level }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private gzipDecompress(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gunzip(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private deflateCompress(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.deflate(buffer, { level: this.config.level }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private deflateDecompress(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.inflate(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private brotliCompress(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.brotliCompress(
        buffer,
        {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.config.level,
          },
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        },
      );
    });
  }

  private brotliDecompress(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.brotliDecompress(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }
}
