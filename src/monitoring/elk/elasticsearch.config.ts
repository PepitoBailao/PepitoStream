import { Injectable } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import * as pino from 'pino';
import * as pinoElasticsearch from 'pino-elasticsearch';

@Injectable()
export class ElasticsearchService {
  private client: Client;
  private logger: any;

  constructor() {
    this.initializeClient();
    this.initializeLogger();
  }

  private initializeClient() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USER || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
      },
      maxRetries: 5,
      requestTimeout: 30000,
      enableMetaHeader: false,
    });
  }

  private initializeLogger() {
    const transport = pinoElasticsearch({
      node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USER || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
      },
      index: 'pepitostream-logs',
    });

    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
    }, transport);
  }

  async createIndices() {
    const indices = [
      {
        name: 'pepitostream-logs',
        settings: {
          number_of_shards: 3,
          number_of_replicas: 1,
          'index.lifecycle.name': 'pepitostream-logs-policy',
          'index.lifecycle.rollover_alias': 'pepitostream-logs-alias',
        },
      },
      {
        name: 'pepitostream-metrics',
        settings: {
          number_of_shards: 2,
          number_of_replicas: 1,
        },
      },
      {
        name: 'pepitostream-traces',
        settings: {
          number_of_shards: 2,
          number_of_replicas: 1,
        },
      },
    ];

    for (const index of indices) {
      try {
        const exists = await this.client.indices.exists({ index: index.name });
        if (!exists) {
          await this.client.indices.create({
            index: index.name,
            settings: index.settings,
            mappings: this.getMappings(index.name),
          });
          console.log(`Index ${index.name} created`);
        }
      } catch (error) {
        console.error(`Error creating index ${index.name}:`, error);
      }
    }
  }

  private getMappings(indexName: string) {
    const baseMappings = {
      properties: {
        '@timestamp': { type: 'date' },
        level: { type: 'keyword' },
        message: { type: 'text' },
        service: { type: 'keyword' },
        environment: { type: 'keyword' },
        hostname: { type: 'keyword' },
      },
    };

    if (indexName === 'pepitostream-logs') {
      return {
        ...baseMappings,
        properties: {
          ...baseMappings.properties,
          context: { type: 'object', enabled: true },
          stack_trace: { type: 'text' },
          user_id: { type: 'keyword' },
          request_id: { type: 'keyword' },
          duration_ms: { type: 'long' },
          status_code: { type: 'integer' },
        },
      };
    }

    if (indexName === 'pepitostream-metrics') {
      return {
        ...baseMappings,
        properties: {
          ...baseMappings.properties,
          metric_name: { type: 'keyword' },
          metric_value: { type: 'double' },
          metric_type: { type: 'keyword' },
          labels: { type: 'object', enabled: true },
        },
      };
    }

    if (indexName === 'pepitostream-traces') {
      return {
        ...baseMappings,
        properties: {
          ...baseMappings.properties,
          trace_id: { type: 'keyword' },
          span_id: { type: 'keyword' },
          parent_span_id: { type: 'keyword' },
          span_name: { type: 'keyword' },
          span_kind: { type: 'keyword' },
          duration_ns: { type: 'long' },
          status: { type: 'keyword' },
          attributes: { type: 'object', enabled: true },
        },
      };
    }

    return baseMappings;
  }

  async logMessage(message: string, meta?: any) {
    this.logger.info(meta || {}, message);
  }

  async logError(error: Error, meta?: any) {
    this.logger.error({
      ...meta,
      error: error.message,
      stack_trace: error.stack,
    }, 'Error occurred');
  }

  async search(indexName: string, query: any) {
    try {
      const result = await this.client.search({
        index: indexName,
        body: query,
      });
      return result.hits.hits.map(hit => hit._source);
    } catch (error) {
      console.error(`Error searching index ${indexName}:`, error);
      throw error;
    }
  }

  async getMetrics(timeRange: { start: string; end: string }) {
    return this.search('pepitostream-metrics', {
      query: {
        range: {
          '@timestamp': {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      },
      aggs: {
        by_metric: {
          terms: {
            field: 'metric_name',
            size: 100,
          },
          aggs: {
            metric_stats: {
              stats: {
                field: 'metric_value',
              },
            },
          },
        },
      },
    });
  }

  async getLogs(query: string, timeRange: { start: string; end: string }) {
    return this.search('pepitostream-logs', {
      query: {
        bool: {
          must: [
            { query_string: { query } },
            {
              range: {
                '@timestamp': {
                  gte: timeRange.start,
                  lte: timeRange.end,
                },
              },
            },
          ],
        },
      },
      size: 1000,
      sort: [{ '@timestamp': { order: 'desc' } }],
    });
  }

  async health() {
    return this.client.cluster.health();
  }
}