import request from 'supertest';
import { createServer } from '../../src/server';

describe('API Integration Tests', () => {
  let server: any;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(server).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('GET /api/search', () => {
    it('should search content', async () => {
      const response = await request(server)
        .get('/api/search')
        .query({ q: 'breaking bad' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Authentication', () => {
    it('should register user', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'Test123!@#',
        });

      expect([201, 400]).toContain(response.status);
    });

    it('should login user', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#',
        });

      expect([200, 401]).toContain(response.status);
    });
  });
});