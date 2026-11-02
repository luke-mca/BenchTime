import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { ReservationService } from '../src/services/reservationService.js';
import { TokenService } from '../src/services/tokenService.js';
import { LabRepository } from '../src/repositories/labRepository.js';
import { ReservationRepository } from '../src/repositories/reservationRepository.js';
import { createApp } from '../src/app.js';

//Allow a manager to edit/cancel reservations in labs they own.
vi.mock('../src/repositories/labRepository.js', () => ({
  LabRepository: {
    findOwnedBy: vi.fn(),
    findForMember: vi.fn(),
  },
}));

vi.mock('../src/repositories/reservationRepository.js', () => ({
  ReservationRepository: {
    updateInLab: vi.fn(),
    deleteInLab: vi.fn(),
    deleteOwn: vi.fn(),
  },
}));

const MANAGER = { id: '7', role: 'manager' };
const MEMBER = { id: '8', role: 'member' };
const LAB = { id: '5', name: 'Chem Lab' };

//Times are relative to now so the tests never fall into the past.
function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

const NEW_START = hoursFromNow(3);
const NEW_END = hoursFromNow(4);

beforeEach(() => {
  vi.resetAllMocks();
  LabRepository.findOwnedBy.mockResolvedValue(LAB);
  LabRepository.findForMember.mockResolvedValue(LAB);
  ReservationRepository.updateInLab.mockImplementation(async ({ reservationId, startTime, endTime }) => ({
    id: reservationId,
    equipmentId: '9',
    userId: MEMBER.id,
    username: 'member1',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  }));
  ReservationRepository.deleteInLab.mockResolvedValue(true);
  ReservationRepository.deleteOwn.mockResolvedValue(true);
});

describe('ReservationService.updateReservation', () => {
  it('lets a manager change the times of a member\'s reservation', async () => {
    const reservation = await ReservationService.updateReservation({
      labId: '5',
      reservationId: '100',
      startTime: NEW_START,
      endTime: NEW_END,
      ownerId: MANAGER.id,
    });

    expect(LabRepository.findOwnedBy).toHaveBeenCalledWith('5', MANAGER.id);
    expect(ReservationRepository.updateInLab).toHaveBeenCalledWith({
      labId: '5',
      reservationId: '100',
      startTime: new Date(NEW_START),
      endTime: new Date(NEW_END),
    });
    expect(reservation).toEqual({
      id: '100',
      equipmentId: '9',
      username: 'member1',
      startTime: NEW_START,
      endTime: NEW_END,
      isMine: false,
    });
  });

  it('rejects a lab the manager does not own', async () => {
    LabRepository.findOwnedBy.mockResolvedValue(null);

    await expect(
      ReservationService.updateReservation({
        labId: '5', reservationId: '100', startTime: NEW_START, endTime: NEW_END, ownerId: MANAGER.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(ReservationRepository.updateInLab).not.toHaveBeenCalled();
  });

  it('rejects a reservation that does not exist or has already ended', async () => {
    ReservationRepository.updateInLab.mockResolvedValue(null);

    await expect(
      ReservationService.updateReservation({
        labId: '5', reservationId: '100', startTime: NEW_START, endTime: NEW_END, ownerId: MANAGER.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects new times where the end is before the start', async () => {
    await expect(
      ReservationService.updateReservation({
        labId: '5', reservationId: '100', startTime: NEW_END, endTime: NEW_START, ownerId: MANAGER.id,
      }),
    ).rejects.toMatchObject({ status: 400, code: 'RESERVATION_END_BEFORE_START' });
    expect(ReservationRepository.updateInLab).not.toHaveBeenCalled();
  });

  it('rejects new times that overlap another reservation', async () => {
    ReservationRepository.updateInLab.mockRejectedValue(Object.assign(new Error('conflicting key'), { code: '23P01' }));

    await expect(
      ReservationService.updateReservation({
        labId: '5', reservationId: '100', startTime: NEW_START, endTime: NEW_END, ownerId: MANAGER.id,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'RESERVATION_OVERLAP' });
  });
});

describe('ReservationService.cancelReservation', () => {
  it('lets a manager cancel anyone\'s reservation in their lab', async () => {
    await ReservationService.cancelReservation({ labId: '5', reservationId: '100', user: MANAGER });

    expect(ReservationRepository.deleteInLab).toHaveBeenCalledWith({ labId: '5', reservationId: '100' });
    expect(ReservationRepository.deleteOwn).not.toHaveBeenCalled();
  });

  it('only lets a member cancel their own reservation', async () => {
    await ReservationService.cancelReservation({ labId: '5', reservationId: '100', user: MEMBER });

    expect(ReservationRepository.deleteOwn).toHaveBeenCalledWith({ labId: '5', reservationId: '100', userId: MEMBER.id });
    expect(ReservationRepository.deleteInLab).not.toHaveBeenCalled();
  });

  it('rejects a reservation that does not exist or has already ended', async () => {
    ReservationRepository.deleteInLab.mockResolvedValue(false);

    await expect(
      ReservationService.cancelReservation({ labId: '5', reservationId: '100', user: MANAGER }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects a lab the manager does not own', async () => {
    LabRepository.findOwnedBy.mockResolvedValue(null);

    await expect(
      ReservationService.cancelReservation({ labId: '5', reservationId: '100', user: MANAGER }),
    ).rejects.toMatchObject({ status: 404 });
    expect(ReservationRepository.deleteInLab).not.toHaveBeenCalled();
  });
});

describe('/api/labs/:id/reservations/:reservationId', () => {
  const app = createApp();

  //Signs a request in as the given user by attaching an access token cookie.
  function authCookie(user) {
    const { accessToken } = TokenService.issueTokens(user);
    return `bt_access=${accessToken}`;
  }

  it('lets a manager edit a reservation (200)', async () => {
    const res = await request(app)
      .patch('/api/labs/5/reservations/100')
      .set('Cookie', authCookie(MANAGER))
      .send({ startTime: NEW_START, endTime: NEW_END });

    expect(res.status).toBe(200);
    expect(res.body.reservation).toMatchObject({ id: '100', startTime: NEW_START, endTime: NEW_END });
  });

  it('does not let a member edit a reservation (403)', async () => {
    const res = await request(app)
      .patch('/api/labs/5/reservations/100')
      .set('Cookie', authCookie(MEMBER))
      .send({ startTime: NEW_START, endTime: NEW_END });

    expect(res.status).toBe(403);
    expect(ReservationRepository.updateInLab).not.toHaveBeenCalled();
  });

  it('lets a manager cancel a reservation (204)', async () => {
    const res = await request(app)
      .delete('/api/labs/5/reservations/100')
      .set('Cookie', authCookie(MANAGER));

    expect(res.status).toBe(204);
  });

  it('does not let a member cancel someone else\'s reservation (404)', async () => {
    //deleteOwn only matches the member's own reservations.
    ReservationRepository.deleteOwn.mockResolvedValue(false);

    const res = await request(app)
      .delete('/api/labs/5/reservations/100')
      .set('Cookie', authCookie(MEMBER));

    expect(res.status).toBe(404);
  });
});
