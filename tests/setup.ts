import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Setup test database and Redis connections
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Cleanup
});