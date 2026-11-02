import { describe, it, expect } from 'vitest';
import request from 'supertest';

//This file tests the rate limiting for express to ensure that endpoints can still be accessed, 
//but not too quickly. 

process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/benchtime_test';
process.env.ACCESS_TOKEN_SECRET ??= 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET ??= 'test-refresh-secret';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

const { createApp } = await import('../src/app.js');

const windowMs = 60_000;

describe('rate limiting', () => {
  it('allows requests under the limit', async () => {
    const app = createApp({ rateLimits: { api: { windowMs, limit: 3 }, auth: { windowMs, limit: 3 } } });

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    }

  });

  it('rejects requests over the limit sending a 429', async () => {
    const app = createApp({ rateLimits: { api: { windowMs, limit: 2 }, auth: { windowMs, limit: 2 } } });

    await request(app).get('/api/health').expect(200);
    await request(app).get('/api/health').expect(200);

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
    });
  });

  it('applies a stricter limit to auth routes', async () => {
    const app = createApp({ rateLimits: { api: { windowMs, limit: 10 }, auth: { windowMs, limit: 1 } } });

    await request(app).post('/api/auth/login').expect(401);
    await request(app).post('/api/auth/login').expect(429);
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/health').expect(200);
  });

  it('sends rate limit headers', async () => {
    const app = createApp({ rateLimits: { api: { windowMs, limit: 5 }, auth: { windowMs, limit: 5 } } });

    const res = await request(app).get('/api/health');
    expect(res.headers).toHaveProperty('ratelimit-policy');
    expect(res.headers).toHaveProperty('ratelimit');
  });
});
