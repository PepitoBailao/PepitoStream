import { Test, TestingModule } from '@nestjs/testing';
import { QueryOptimizer } from '../query.optimizer';

describe('QueryOptimizer', () => {
  let service: QueryOptimizer;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueryOptimizer]
    }).compile();

    service = module.get<QueryOptimizer>(QueryOptimizer);
  });

  describe('Query Analysis', () => {
    it('should analyze simple SELECT query', async () => {
      const mockQuery = {
        getSql: () => 'SELECT id, name FROM users WHERE id = ?',
        getParameters: () => [1]
      } as any;

      const plan = await service.analyzeQuery(mockQuery);

      expect(plan).toBeDefined();
      expect(plan.sql).toContain('SELECT');
      expect(plan.indexes.length).toBeGreaterThan(0);
    });

    it('should detect SELECT * anti-pattern', async () => {
      const mockQuery = {
        getSql: () => 'SELECT * FROM users',
        getParameters: () => []
      } as any;

      const plan = await service.analyzeQuery(mockQuery);

      expect(plan.optimizations).toContain('Avoid SELECT * - specify needed columns');
    });

    it('should suggest IN clause instead of multiple ORs', async () => {
      const mockQuery = {
        getSql: () => 'SELECT * FROM users WHERE id = 1 OR id = 2 OR id = 3 OR id = 4',
        getParameters: () => []
      } as any;

      const plan = await service.analyzeQuery(mockQuery);

      expect(plan.optimizations.some(opt => opt.includes('IN clause'))).toBe(true);
    });

    it('should warn about LIKE with leading wildcard', async () => {
      const mockQuery = {
        getSql: () => "SELECT * FROM users WHERE name LIKE '%john'",
        getParameters: () => []
      } as any;

      const plan = await service.analyzeQuery(mockQuery);

      expect(plan.optimizations.some(opt => opt.includes('leading wildcard'))).toBe(true);
    });
  });

  describe('Query Statistics', () => {
    it('should track query statistics', () => {
      const stats = service.getQueryStats();

      expect(stats).toHaveProperty('totalQueries');
      expect(stats).toHaveProperty('avgExecutionTime');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('slowQueries');
    });

    it('should reset statistics', () => {
      service.resetStats();
      const stats = service.getQueryStats();

      expect(stats.totalQueries).toBe(0);
    });
  });

  describe('N+1 Query Detection', () => {
    it('should detect N+1 query pattern', () => {
      const queries = Array(15).fill('SELECT * FROM posts WHERE user_id = ?');
      const result = service.detectNPlusOne(queries);

      expect(result.hasNPlusOne).toBe(true);
      expect(result.analysis.length).toBeGreaterThan(0);
    });

    it('should not flag normal query patterns', () => {
      const queries = ['SELECT * FROM users', 'SELECT * FROM posts'];
      const result = service.detectNPlusOne(queries);

      expect(result.hasNPlusOne).toBe(false);
    });
  });

  describe('Index Suggestions', () => {
    it('should suggest indexes for WHERE clauses', () => {
      const sql = 'SELECT * FROM users WHERE id = ? AND email = ?';
      const suggestions = service.suggestIndexes(sql);

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest indexes for JOIN conditions', () => {
      const sql = 'SELECT * FROM users JOIN posts ON users.id = posts.user_id';
      const suggestions = service.suggestIndexes(sql);

      expect(suggestions.some(s => s.includes('JOIN'))).toBe(true);
    });
  });
});
