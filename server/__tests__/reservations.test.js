import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { ReservationService } from '../src/services/reservationService.js';
import { TokenService } from '../src/services/tokenService.js';
import { LabRepository } from '../src/repositories/labRepository.js';
import { ReservationRepository } from '../src/repositories/reservationRepository.js';
import { createApp } from '../src/app.js';

//Tests for allowing any manager/member to reserve equipment.
vi.mock('../src/repositories/labRepository.js', () => ({
  LabRepository: {
    findOwnedBy: vi.fn(),
    findForMember: vi.fn(),
  },
}));

vi.mock('../src/repositories/reservationRepository.js', () => ({
  ReservationRepository: {
    create: vi.fn(),
  },
}));

const MANAGER = { id: '7', role: 'manager' };
const MEMBER = { id: '8', role: 'member' };
const LAB = { id: '5', name: 'Chem Lab' };

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

const START = hoursFromNow(1);
const END = hoursFromNow(2);

beforeEach(() => {
  vi.resetAllMocks();
  LabRepository.findOwnedBy.mockResolvedValue(LAB);
  LabRepository.findForMember.mockResolvedValue(LAB);
  ReservationRepository.create.mockImplementation(async ({ equipmentId, userId, startTime, endTime }) => ({
    id: '100',
    equipmentId,
    userId,
    username: userId === MEMBER.id ? 'member1' : 'manager1',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  }));
});

describe('ReservationService.createReservation', () => {
  it('lets a member reserve equipment in a lab they were added to', async () => {
    const reservation = await ReservationService.createReservation({
      labId: '5',
      equipmentId: '9',
      startTime: START,
      endTime: END,
      user: MEMBER,
    });

    expect(LabRepository.findForMember).toHaveBeenCalledWith('5', MEMBER.id);
    expect(ReservationRepository.create).toHaveBeenCalledWith({
      labId: '5',
      equipmentId: '9',
      userId: MEMBER.id,
      startTime: new Date(START),
      endTime: new Date(END),
    });
    expect(reservation).toEqual({
      id: '100',
      equipmentId: '9',
      username: 'member1',
      startTime: START,
      endTime: END,
      isMine: true,
    });
  });

  it('lets a manager reserve equipment in a lab they own', async () => {
    const reservation = await ReservationService.createReservation({
      labId: '5',
      equipmentId: '9',
      startTime: START,
      endTime: END,
      user: MANAGER,
    });

    expect(LabRepository.findOwnedBy).toHaveBeenCalledWith('5', MANAGER.id);
    expect(reservation).toMatchObject({ username: 'manager1', isMine: true });
  });

  it('rejects a user who has no access to the lab', async () => {
    LabRepository.findForMember.mockResolvedValue(null);

    await expect(
      ReservationService.createReservation({ labId: '5', equipmentId: '9', startTime: START, endTime: END, user: MEMBER }),
    ).rejects.toMatchObject({ status: 404 });
    expect(ReservationRepository.create).not.toHaveBeenCalled();
  });

  it('rejects equipment that is not in the lab', async () => {
    ReservationRepository.create.mockResolvedValue(null);

    await expect(
      ReservationService.createReservation({ labId: '5', equipmentId: '9', startTime: START, endTime: END, user: MEMBER }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each([
    ['the time is not a date', 'not-a-date', END, 'INVALID_RESERVATION_TIME'],
    ['the end is before the start', END, START, 'RESERVATION_END_BEFORE_START'],
    ['it starts in the past', hoursFromNow(-2), hoursFromNow(-1), 'RESERVATION_IN_PAST'],
    ['it is longer than 6 hours', hoursFromNow(1), hoursFromNow(8), 'RESERVATION_TOO_LONG'],
  ])('rejects a reservation when %s', async (_label, startTime, endTime, code) => {
    await expect(
      ReservationService.createReservation({ labId: '5', equipmentId: '9', startTime, endTime, user: MEMBER }),
    ).rejects.toMatchObject({ status: 400, code });
    expect(ReservationRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a time that overlaps an existing reservation', async () => {
    ReservationRepository.create.mockRejectedValue(Object.assign(new Error('conflicting key'), { code: '23P01' }));

    await expect(
      ReservationService.createReservation({ labId: '5', equipmentId: '9', startTime: START, endTime: END, user: MEMBER }),
    ).rejects.toMatchObject({ status: 409, code: 'RESERVATION_OVERLAP' });
  });
});

describe('POST /api/labs/:id/equipment/:equipmentId/reservations', () => {
  const app = createApp();

  function authCookie(user) {
    const { accessToken } = TokenService.issueTokens(user);
    return `bt_access=${accessToken}`;
  }

  function reserve(body, user) {
    const req = request(app).post('/api/labs/5/equipment/9/reservations');
    return user ? req.set('Cookie', authCookie(user)).send(body) : req.send(body);
  }

  it.each([
    ['member', MEMBER],
    ['manager', MANAGER],
  ])('lets a %s reserve equipment (201)', async (_role, user) => {
    const res = await reserve({ startTime: START, endTime: END }, user);

    expect(res.status).toBe(201);
    expect(res.body.reservation).toMatchObject({ id: '100', equipmentId: '9', isMine: true });
  });

  it('requires the user to be signed in 401', async () => {
    const res = await reserve({ startTime: START, endTime: END });

    expect(res.status).toBe(401);
    expect(ReservationRepository.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the time is already booked', async () => {
    ReservationRepository.create.mockRejectedValue(Object.assign(new Error('conflicting key'), { code: '23P01' }));

    const res = await reserve({ startTime: START, endTime: END }, MEMBER);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RESERVATION_OVERLAP');
  });
});
