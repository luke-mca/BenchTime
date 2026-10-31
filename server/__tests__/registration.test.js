import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { AuthService } from '../src/services/authService.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { createApp } from '../src/app.js';

//Member/Lab Manager registration tests.
//The repository is just a mock so no database is needed. See vitest.config.js for details. 
vi.mock('../src/repositories/userRepository.js', () => ({
  UserRepository: {
    findByUsername: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

const PASSWORD = 'correct-horse';

beforeEach(() => {
  vi.resetAllMocks();
  UserRepository.findByUsername.mockResolvedValue(null);
  UserRepository.create.mockImplementation(async ({ username, passwordHash, role }) => ({
    id: 42,
    username,
    password_hash: passwordHash,
    role,
  }));
});

describe('AuthService.register', () => {
  it.each(['member', 'manager'])('registers a %s', async (role) => {
    const result = await AuthService.register({ username: 'alice', password: PASSWORD, role });

    expect(result.user).toEqual({ id: '42', username: 'alice', role });
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
  });

  it('stores a bcrypt hash, never the plain password', async () => {
    await AuthService.register({ username: 'alice', password: PASSWORD, role: 'member' });

    const { passwordHash } = UserRepository.create.mock.calls[0][0];
    expect(passwordHash).not.toBe(PASSWORD);
    expect(await bcrypt.compare(PASSWORD, passwordHash)).toBe(true);
  });

  it.each([
    ['username is missing', { password: PASSWORD, role: 'member' }, 'MISSING_USERNAME'],
    ['password is missing', { username: 'alice', role: 'member' }, 'MISSING_PASSWORD'],
    ['role is invalid', { username: 'alice', password: PASSWORD, role: 'admin' }, 'INVALID_ROLE'],
    ['password is too short', { username: 'alice', password: 'short', role: 'member' }, 'WEAK_PASSWORD'],
    ['password is over 72 bytes', { username: 'alice', password: 'é'.repeat(37), role: 'member' }, 'WEAK_PASSWORD'],
    ['username has invalid characters', { username: 'alice smith', password: PASSWORD, role: 'member' }, 'INVALID_USERNAME'],
  ])('rejects registration when %s', async (_label, input, code) => {
    await expect(AuthService.register(input)).rejects.toMatchObject({ status: 400, code });
    expect(UserRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a username that is already taken', async () => {
    UserRepository.findByUsername.mockResolvedValue({ id: 1, username: 'alice', role: 'member' });

    await expect(
      AuthService.register({ username: 'alice', password: PASSWORD, role: 'member' }),
    ).rejects.toMatchObject({ status: 409, code: 'USERNAME_TAKEN' });
    expect(UserRepository.create).not.toHaveBeenCalled();
  });

  it('reports USERNAME_TAKEN when the unique index catches a race', async () => {
    UserRepository.create.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));

    await expect(
      AuthService.register({ username: 'alice', password: PASSWORD, role: 'member' }),
    ).rejects.toMatchObject({ status: 409, code: 'USERNAME_TAKEN' });
  });

  it('passes other database errors through unchanged', async () => {
    const dbError = new Error('connection lost');
    UserRepository.create.mockRejectedValue(dbError);

    await expect(
      AuthService.register({ username: 'alice', password: PASSWORD, role: 'member' }),
    ).rejects.toBe(dbError);
  });
});

describe('POST /api/auth/register', () => {
  const app = createApp();

  it('returns 201 with the user and sets auth cookies', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: PASSWORD, role: 'manager' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ user: { id: '42', username: 'alice', role: 'manager' } });

    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toMatch(/bt_access=/);
    expect(cookies).toMatch(/bt_refresh=/);
  });

  it('returns 400 for invalid input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: PASSWORD, role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ROLE');
  });

  it('returns 409 when the username is taken', async () => {
    UserRepository.findByUsername.mockResolvedValue({ id: 1, username: 'alice', role: 'member' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: PASSWORD, role: 'member' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });
});
