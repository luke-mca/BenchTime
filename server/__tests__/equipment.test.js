import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { LabService } from '../src/services/labService.js';
import { TokenService } from '../src/services/tokenService.js';
import { LabRepository } from '../src/repositories/labRepository.js';
import { EquipmentRepository } from '../src/repositories/equipmentRepository.js';
import { createApp } from '../src/app.js';

//Equipment CRUD and assigning equipment to a lab.
vi.mock('../src/repositories/labRepository.js', () => ({
  LabRepository: {
    findOwnedBy: vi.fn(),
    findForMember: vi.fn(),
  },
}));

vi.mock('../src/repositories/equipmentRepository.js', () => ({
  EquipmentRepository: {
    listActiveByLab: vi.fn(),
    create: vi.fn(),
    deactivate: vi.fn(),
  },
}));

const MANAGER_ID = '7';
const MEMBER_ID = '8';
const LAB = { id: '5', name: 'Chem Lab' };
const MICROSCOPE = { id: '9', name: 'Microscope', description: 'Zeiss', createdAt: '2026-10-01T00:00:00.000Z' };

beforeEach(() => {
  vi.resetAllMocks();
  LabRepository.findOwnedBy.mockResolvedValue(LAB);
  LabRepository.findForMember.mockResolvedValue(LAB);
  EquipmentRepository.listActiveByLab.mockResolvedValue([MICROSCOPE]);
  EquipmentRepository.create.mockImplementation(async ({ name, description }) => ({
    id: '9',
    name,
    description,
    createdAt: MICROSCOPE.createdAt,
  }));
  EquipmentRepository.deactivate.mockResolvedValue(true);
});

describe('LabService.addEquipment', () => {
  it('adds equipment to the manager\'s lab', async () => {
    const equipment = await LabService.addEquipment({
      labId: '5',
      name: '  Microscope  ',
      description: 'Zeiss',
      ownerId: MANAGER_ID,
    });

    expect(LabRepository.findOwnedBy).toHaveBeenCalledWith('5', MANAGER_ID);
    expect(EquipmentRepository.create).toHaveBeenCalledWith({ labId: '5', name: 'Microscope', description: 'Zeiss' });
    expect(equipment).toEqual(MICROSCOPE);
  });

  it('treats the description as optional', async () => {
    await LabService.addEquipment({ labId: '5', name: 'Microscope', ownerId: MANAGER_ID });

    expect(EquipmentRepository.create).toHaveBeenCalledWith(expect.objectContaining({ description: '' }));
  });

  it.each([
    ['the name is missing', {}, 'MISSING_EQUIPMENT_NAME'],
    ['the name is too long', { name: 'a'.repeat(51) }, 'EQUIPMENT_NAME_TOO_LONG'],
    ['the description is too long', { name: 'Microscope', description: 'a'.repeat(501) }, 'EQUIPMENT_DESCRIPTION_TOO_LONG'],
  ])('rejects equipment when %s', async (_label, input, code) => {
    await expect(
      LabService.addEquipment({ labId: '5', ownerId: MANAGER_ID, ...input }),
    ).rejects.toMatchObject({ status: 400, code });
    expect(EquipmentRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a lab the manager does not own', async () => {
    LabRepository.findOwnedBy.mockResolvedValue(null);

    await expect(
      LabService.addEquipment({ labId: '5', name: 'Microscope', ownerId: MANAGER_ID }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(EquipmentRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate equipment name in the same lab', async () => {
    EquipmentRepository.create.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));

    await expect(
      LabService.addEquipment({ labId: '5', name: 'Microscope', ownerId: MANAGER_ID }),
    ).rejects.toMatchObject({ status: 409, code: 'EQUIPMENT_NAME_TAKEN' });
  });

  it('rejects a description that is not text', async () => {
    await expect(
      LabService.addEquipment({ labId: '5', name: 'Microscope', description: 42, ownerId: MANAGER_ID }),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_EQUIPMENT_DESCRIPTION' });
  });

  it('passes other database errors through unchanged', async () => {
    const dbError = new Error('connection lost');
    EquipmentRepository.create.mockRejectedValue(dbError);

    await expect(
      LabService.addEquipment({ labId: '5', name: 'Microscope', ownerId: MANAGER_ID }),
    ).rejects.toBe(dbError);
  });
});

describe('LabService.listEquipment', () => {
  it('lists equipment for the manager who owns the lab', async () => {
    const equipment = await LabService.listEquipment({ labId: '5', userId: MANAGER_ID, role: 'manager' });

    expect(LabRepository.findOwnedBy).toHaveBeenCalledWith('5', MANAGER_ID);
    expect(equipment).toEqual([MICROSCOPE]);
  });

  it('lists equipment for a member of the lab', async () => {
    const equipment = await LabService.listEquipment({ labId: '5', userId: MEMBER_ID, role: 'member' });

    expect(LabRepository.findForMember).toHaveBeenCalledWith('5', MEMBER_ID);
    expect(equipment).toEqual([MICROSCOPE]);
  });

  it('rejects a member who was not added to the lab', async () => {
    LabRepository.findForMember.mockResolvedValue(null);

    await expect(
      LabService.listEquipment({ labId: '5', userId: MEMBER_ID, role: 'member' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(EquipmentRepository.listActiveByLab).not.toHaveBeenCalled();
  });
});

describe('LabService.removeEquipment', () => {
  it('removes equipment from the manager\'s lab', async () => {
    await LabService.removeEquipment({ labId: '5', equipmentId: '9', ownerId: MANAGER_ID });

    expect(EquipmentRepository.deactivate).toHaveBeenCalledWith('5', '9');
  });

  it('rejects equipment that is not in the lab', async () => {
    EquipmentRepository.deactivate.mockResolvedValue(false);

    await expect(
      LabService.removeEquipment({ labId: '5', equipmentId: '9', ownerId: MANAGER_ID }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('/api/labs/:id/equipment', () => {
  const app = createApp();

  function authCookie(id, role) {
    const { accessToken } = TokenService.issueTokens({ id, role });
    return `bt_access=${accessToken}`;
  }

  it('lets a manager add equipment (201)', async () => {
    const res = await request(app)
      .post('/api/labs/5/equipment')
      .set('Cookie', authCookie(MANAGER_ID, 'manager'))
      .send({ name: 'Microscope', description: 'Zeiss' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ equipment: MICROSCOPE });
  });

  it('does not let a member add equipment 403', async () => {
    const res = await request(app)
      .post('/api/labs/5/equipment')
      .set('Cookie', authCookie(MEMBER_ID, 'member'))
      .send({ name: 'Microscope' });

    expect(res.status).toBe(403);
    expect(EquipmentRepository.create).not.toHaveBeenCalled();
  });

  it('requires the user to be signed in (401)', async () => {
    const res = await request(app).post('/api/labs/5/equipment').send({ name: 'Microscope' });

    expect(res.status).toBe(401);
  });

  it('lets a member list equipment 203', async () => {
    const res = await request(app)
      .get('/api/labs/5/equipment')
      .set('Cookie', authCookie(MEMBER_ID, 'member'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ equipment: [MICROSCOPE] });
  });

  it('lets a manager remove equipment (204)', async () => {
    const res = await request(app)
      .delete('/api/labs/5/equipment/9')
      .set('Cookie', authCookie(MANAGER_ID, 'manager'));

    expect(res.status).toBe(204);
  });
});
