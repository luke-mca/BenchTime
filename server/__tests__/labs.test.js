import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { LabService } from '../src/services/labService.js';
import { TokenService } from '../src/services/tokenService.js';
import { LabRepository } from '../src/repositories/labRepository.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { createApp } from '../src/app.js';

//Creating labs and adding members to a lab.
vi.mock('../src/repositories/labRepository.js', () => ({
  LabRepository: {
    createLab: vi.fn(),
    findOwnedBy: vi.fn(),
    addMember: vi.fn(),
  },
}));

vi.mock('../src/repositories/userRepository.js', () => ({
  UserRepository: {
    findByUsername: vi.fn(),
  },
}));

const MANAGER_ID = '7';
const MEMBER_ID = '8';
const LAB = {
  id: '5',
  name: 'Chem Lab',
  createdAt: '2026-10-01T00:00:00.000Z',
  ownerUsername: 'manager1',
  memberCount: 0,
  equipmentCount: 0,
};
const luke = { id: MEMBER_ID, username: 'luke', role: 'member' };
const ADDED_AT = '2026-10-02T00:00:00.000Z';
const LUKE_MEMBERSHIP = { id: MEMBER_ID, username: 'luke', addedAt: ADDED_AT };

beforeEach(() => {
  vi.resetAllMocks();
  LabRepository.createLab.mockImplementation(async ({ name }) => ({ ...LAB, name }));
  LabRepository.findOwnedBy.mockResolvedValue(LAB);
  LabRepository.addMember.mockResolvedValue({ addedAt: ADDED_AT });
  UserRepository.findByUsername.mockResolvedValue(luke);
});

describe('LabService.createLab', () => {
  it('creates a lab for the manager with a trimmed name', async () => {
    const lab = await LabService.createLab({ name: '  Chem Lab  ', ownerId: MANAGER_ID });

    expect(LabRepository.createLab).toHaveBeenCalledWith({ name: 'Chem Lab', ownerId: MANAGER_ID });
    expect(lab).toEqual(LAB);
  });

  it('allows a name at the maximum length', async () => {
    const name = 'a'.repeat(30);

    const lab = await LabService.createLab({ name, ownerId: MANAGER_ID });

    expect(lab.name).toBe(name);
  });

  it.each([
    ['the name is missing', {}, 'MISSING_LAB_NAME'],
    ['the name is blank', { name: '   ' }, 'MISSING_LAB_NAME'],
    ['the name is too long', { name: 'a'.repeat(31) }, 'LAB_NAME_TOO_LONG'],
  ])('rejects a lab when %s', async (_label, input, code) => {
    await expect(
      LabService.createLab({ ownerId: MANAGER_ID, ...input }),
    ).rejects.toMatchObject({ status: 400, code });
    expect(LabRepository.createLab).not.toHaveBeenCalled();
  });

  it('rejects a lab name the manager already uses', async () => {
    LabRepository.createLab.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));

    await expect(
      LabService.createLab({ name: 'Chem Lab', ownerId: MANAGER_ID }),
    ).rejects.toMatchObject({ status: 409, code: 'LAB_NAME_TAKEN' });
  });

  it('passes other database errors through unchanged', async () => {
    const dbError = new Error('connection lost');
    LabRepository.createLab.mockRejectedValue(dbError);

    await expect(
      LabService.createLab({ name: 'Chem Lab', ownerId: MANAGER_ID }),
    ).rejects.toBe(dbError);
  });
});

describe('LabService.addMember', () => {
  it('adds a member to the manager\'s lab by username', async () => {
    const member = await LabService.addMember({ labId: '5', username: '  luke  ', ownerId: MANAGER_ID });

    expect(LabRepository.findOwnedBy).toHaveBeenCalledWith('5', MANAGER_ID);
    expect(UserRepository.findByUsername).toHaveBeenCalledWith('luke');
    expect(LabRepository.addMember).toHaveBeenCalledWith('5', MEMBER_ID);
    expect(member).toEqual(LUKE_MEMBERSHIP);
  });

  it('rejects a lab the manager does not own', async () => {
    LabRepository.findOwnedBy.mockResolvedValue(null);

    await expect(
      LabService.addMember({ labId: '5', username: 'luke', ownerId: MANAGER_ID }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(LabRepository.addMember).not.toHaveBeenCalled();
  });

  it('rejects a lab id that is not a number', async () => {
    await expect(
      LabService.addMember({ labId: 'abc', username: 'luke', ownerId: MANAGER_ID }),
    ).rejects.toMatchObject({ status: 404 });
    expect(LabRepository.findOwnedBy).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', {}],
    ['blank', { username: '   ' }],
  ])('rejects a username that is %s', async (_label, input) => {
    await expect(
      LabService.addMember({ labId: '5', ownerId: MANAGER_ID, ...input }),
    ).rejects.toMatchObject({ status: 400, code: 'MISSING_USERNAME' });
    expect(LabRepository.addMember).not.toHaveBeenCalled();
  });

  it('rejects a username that does not exist', async () => {
    UserRepository.findByUsername.mockResolvedValue(null);

    await expect(
      LabService.addMember({ labId: '5', username: 'nobody', ownerId: MANAGER_ID }),
    ).rejects.toMatchObject({ status: 404 });
    expect(LabRepository.addMember).not.toHaveBeenCalled();
  });

  it('does not let the owner add themselves', async () => {
    UserRepository.findByUsername.mockResolvedValue({ id: 7, username: 'manager1', role: 'manager' });

    await expect(
      LabService.addMember({ labId: '5', username: 'manager1', ownerId: MANAGER_ID }),
    ).rejects.toMatchObject({ status: 400, code: 'OWNER_CANNOT_BE_MEMBER' });
    expect(LabRepository.addMember).not.toHaveBeenCalled();
  });

  it('does not let another manager be added', async () => {
    UserRepository.findByUsername.mockResolvedValue({ id: '9', username: 'manager2', role: 'manager' });

    await expect(
      LabService.addMember({ labId: '5', username: 'manager2', ownerId: MANAGER_ID }),
    ).rejects.toMatchObject({ status: 400, code: 'NOT_A_MEMBER_ACCOUNT' });
    expect(LabRepository.addMember).not.toHaveBeenCalled();
  });

  it('rejects a user who is already a member', async () => {
    LabRepository.addMember.mockResolvedValue(null);

    await expect(
      LabService.addMember({ labId: '5', username: 'luke', ownerId: MANAGER_ID }),
    ).rejects.toMatchObject({ status: 409, code: 'ALREADY_A_MEMBER' });
  });
});

describe('/api/labs', () => {
  const app = createApp();

  function authCookie(id, role) {
    const { accessToken } = TokenService.issueTokens({ id, role });
    return `bt_access=${accessToken}`;
  }

  describe('POST /api/labs', () => {
    it('lets a manager create a lab (201)', async () => {
      const res = await request(app)
        .post('/api/labs')
        .set('Cookie', authCookie(MANAGER_ID, 'manager'))
        .send({ name: 'Chem Lab' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ lab: LAB });
      expect(LabRepository.createLab).toHaveBeenCalledWith({ name: 'Chem Lab', ownerId: MANAGER_ID });
    });

    it('does not let a member create a lab (403)', async () => {
      const res = await request(app)
        .post('/api/labs')
        .set('Cookie', authCookie(MEMBER_ID, 'member'))
        .send({ name: 'Chem Lab' });

      expect(res.status).toBe(403);
      expect(LabRepository.createLab).not.toHaveBeenCalled();
    });

    it('requires the user to be signed in (401)', async () => {
      const res = await request(app).post('/api/labs').send({ name: 'Chem Lab' });

      expect(res.status).toBe(401);
      expect(LabRepository.createLab).not.toHaveBeenCalled();
    });

    it('returns 400 when the name is missing', async () => {
      const res = await request(app)
        .post('/api/labs')
        .set('Cookie', authCookie(MANAGER_ID, 'manager'))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_LAB_NAME');
    });
  });

  describe('POST /api/labs/:id/members', () => {
    it('lets a manager add a member (201)', async () => {
      const res = await request(app)
        .post('/api/labs/5/members')
        .set('Cookie', authCookie(MANAGER_ID, 'manager'))
        .send({ username: 'luke' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ member: LUKE_MEMBERSHIP });
    });

    it('does not let a member add a member (403)', async () => {
      const res = await request(app)
        .post('/api/labs/5/members')
        .set('Cookie', authCookie(MEMBER_ID, 'member'))
        .send({ username: 'luke' });

      expect(res.status).toBe(403);
      expect(LabRepository.addMember).not.toHaveBeenCalled();
    });

    it('requires the user to be signed in (401)', async () => {
      const res = await request(app).post('/api/labs/5/members').send({ username: 'luke' });

      expect(res.status).toBe(401);
      expect(LabRepository.addMember).not.toHaveBeenCalled();
    });

    it('returns 409 when the user is already a member', async () => {
      LabRepository.addMember.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/labs/5/members')
        .set('Cookie', authCookie(MANAGER_ID, 'manager'))
        .send({ username: 'luke' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_A_MEMBER');
    });
  });
});
