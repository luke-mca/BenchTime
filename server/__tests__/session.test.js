import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { AuthService } from '../src/services/authService.js';
import { TokenService } from '../src/services/tokenService.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { createApp } from '../src/app.js';

//Tests login/token refresh. 
vi.mock('../src/repositories/userRepository.js', () => ({
  UserRepository: {
    findByUsername: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

const PASSWORD = 'correct-horse';
let alice;

beforeAll(async () => {
  alice = { id: 42, username: 'alice', role: 'member', password_hash: await bcrypt.hash(PASSWORD, 4) };
});

beforeEach(() => {
  vi.resetAllMocks();
  UserRepository.findByUsername.mockImplementation(async (username) =>
    username.toLowerCase() === 'alice' ? alice : null,
  );
  UserRepository.findById.mockImplementation(async (id) => (String(id) === '42' ? alice : null));
});

describe('AuthService.login', () => {
  it('signs in with the correct username and password', async () => {
    const result = await AuthService.login({ username: '  alice  ', password: PASSWORD });

    expect(UserRepository.findByUsername).toHaveBeenCalledWith('alice');
    expect(result.user).toEqual({ id: '42', username: 'alice', role: 'member' });
    expect(TokenService.verifyAccessToken(result.accessToken)).toMatchObject({ sub: '42', role: 'member' });
  });

  it.each([
    ['the password is wrong', { username: 'alice', password: 'wrong-password' }],
    ['the username does not exist', { username: 'nobody', password: PASSWORD }],
    ['the fields are missing', {}],
  ])('rejects the login when %s', async (_label, input) => {
    await expect(AuthService.login(input)).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });
});

describe('AuthService.refresh', () => {
  it('issues new tokens from a valid refresh token', async () => {
    const { refreshToken } = TokenService.issueTokens({ id: '42', role: 'member' });

    const result = await AuthService.refresh(refreshToken);

    expect(result.user).toEqual({ id: '42', username: 'alice', role: 'member' });
    expect(TokenService.verifyAccessToken(result.accessToken)).toMatchObject({ sub: '42' });
  });

  it.each([
    ['missing', undefined],
    ['tampered with', 'not.a.real-token'],
    ['an access token', TokenService.issueTokens({ id: '42', role: 'member' }).accessToken],
  ])('rejects a refresh token that is %s', async (_label, token) => {
    await expect(AuthService.refresh(token)).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('rejects a refresh token for a deleted account', async () => {
    const { refreshToken } = TokenService.issueTokens({ id: '99', role: 'member' });

    await expect(AuthService.refresh(refreshToken)).rejects.toMatchObject({ status: 401 });
  });
});

describe('AuthService.getCurrentUser', () => {
  it('returns the signed in user', async () => {
    await expect(AuthService.getCurrentUser('42')).resolves.toEqual({ id: '42', username: 'alice', role: 'member' });
  });

  it('rejects a user that no longer exists', async () => {
    await expect(AuthService.getCurrentUser('99')).rejects.toMatchObject({ status: 401 });
  });
});

describe('session routes', () => {
  const app = createApp();

  function cookieFor(name, token) {
    return `${name}=${token}`;
  }

  function isCleared(setCookies, name) {
    return setCookies.some((c) => c.startsWith(`${name}=;`) && c.includes('1970'));
  }

  describe('POST /api/auth/login', () => {
    it('returns 200 with the user and sets auth cookies', async () => {
      const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: { id: '42', username: 'alice', role: 'member' } });

      const cookies = res.headers['set-cookie'].join(';');
      expect(cookies).toMatch(/bt_access=/);
      expect(cookies).toMatch(/bt_refresh=/);
    });

    it('returns 401 and sets no cookies for a wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns 200 and sets new auth cookies', async () => {
      const { refreshToken } = TokenService.issueTokens({ id: '42', role: 'member' });

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieFor('bt_refresh', refreshToken));

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: '42' });
      expect(res.headers['set-cookie'].join(';')).toMatch(/bt_access=[^;]+/);
    });

    it('returns 401 and clears both cookies for a bad refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieFor('bt_refresh', 'not.a.real-token'));

      expect(res.status).toBe(401);
      expect(isCleared(res.headers['set-cookie'], 'bt_access')).toBe(true);
      expect(isCleared(res.headers['set-cookie'], 'bt_refresh')).toBe(true);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 204 and clears both cookies', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(204);
      expect(isCleared(res.headers['set-cookie'], 'bt_access')).toBe(true);
      expect(isCleared(res.headers['set-cookie'], 'bt_refresh')).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the signed in user', async () => {
      const { accessToken } = TokenService.issueTokens({ id: '42', role: 'member' });

      const res = await request(app).get('/api/auth/me').set('Cookie', cookieFor('bt_access', accessToken));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: { id: '42', username: 'alice', role: 'member' } });
    });

    it.each([
      ['there is no access cookie', null],
      ['the access token is tampered with', 'not.a.real-token'],
    ])('returns 401 when %s', async (_label, token) => {
      const req = request(app).get('/api/auth/me');
      const res = token ? await req.set('Cookie', cookieFor('bt_access', token)) : await req;

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
