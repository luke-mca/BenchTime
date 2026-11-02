import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { ReservationService, STATS_WEEKS } from '../src/services/reservationService.js';
import { TokenService } from '../src/services/tokenService.js';
import { LabRepository } from '../src/repositories/labRepository.js';
import { ReservationRepository } from '../src/repositories/reservationRepository.js';
import { createApp } from '../src/app.js';

//Utilization statistics for the equipment in a lab.
vi.mock('../src/repositories/labRepository.js', () => ({
  LabRepository: {
    findOwnedBy: vi.fn(),
  },
}));

vi.mock('../src/repositories/reservationRepository.js', () => ({
  ReservationRepository: {
    countForLab: vi.fn(),
    hoursByWeekdayAndHour: vi.fn(),
  },
}));

const MANAGER_ID = '7';
const MEMBER_ID = '8';
const LAB = { id: '5', name: 'Chem Lab' };
const MICROSCOPE = { id: 9, name: 'Microscope', active: true, reservationCount: 2 };
const CENTRIFUGE = { id: 10, name: 'Centrifuge', active: true, reservationCount: 0 };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getStats(overrides = {}) {
  return ReservationService.getUtilization({ labId: '5', ownerId: MANAGER_ID, timeZone: 'UTC', ...overrides });
}

beforeEach(() => {
  vi.resetAllMocks();
  LabRepository.findOwnedBy.mockResolvedValue(LAB);
  ReservationRepository.countForLab.mockResolvedValue([MICROSCOPE]);
  ReservationRepository.hoursByWeekdayAndHour.mockResolvedValue([]);
});

describe('ReservationService.getUtilization', () => {
  it('looks up the last four weeks for the manager\'s lab', async () => {
    const stats = await getStats({ timeZone: 'America/Chicago' });

    expect(LabRepository.findOwnedBy).toHaveBeenCalledWith('5', MANAGER_ID);
    expect(stats.weeks).toBe(STATS_WEEKS);
    expect(stats.to - stats.from).toBe(STATS_WEEKS * WEEK_MS);
    expect(ReservationRepository.countForLab).toHaveBeenCalledWith({ labId: '5', from: stats.from, to: stats.to });
    expect(ReservationRepository.hoursByWeekdayAndHour).toHaveBeenCalledWith({
      labId: '5',
      from: stats.from,
      to: stats.to,
      timeZone: 'America/Chicago',
    });
  });

  it('adds up hours by weekday and hour', async () => {
    ReservationRepository.hoursByWeekdayAndHour.mockResolvedValue([
      { equipmentId: 9, weekday: 2, hour: 10, hours: 1 },
      { equipmentId: 9, weekday: 2, hour: 11, hours: 0.5 },
      { equipmentId: 9, weekday: 4, hour: 10, hours: 2 },
    ]);

    const { equipment } = await getStats();

    expect(equipment[0].totalHours).toBe(3.5);
    expect(equipment[0].hoursByWeekday).toEqual([0, 1.5, 0, 2, 0, 0, 0]);
    expect(equipment[0].hoursByHour[10]).toBe(3);
    expect(equipment[0].hoursByHour[11]).toBe(0.5);
  });

  it('puts Monday first and Sunday last', async () => {
    ReservationRepository.hoursByWeekdayAndHour.mockResolvedValue([
      { equipmentId: 9, weekday: 1, hour: 0, hours: 1 },
      { equipmentId: 9, weekday: 7, hour: 23, hours: 2 },
    ]);

    const { equipment } = await getStats();

    expect(equipment[0].hoursByWeekday).toEqual([1, 0, 0, 0, 0, 0, 2]);
    expect(equipment[0].hoursByHour[0]).toBe(1);
    expect(equipment[0].hoursByHour[23]).toBe(2);
  });

  it('keeps each piece of equipment separate and returns zeros for unused equipment', async () => {
    ReservationRepository.countForLab.mockResolvedValue([MICROSCOPE, CENTRIFUGE]);
    ReservationRepository.hoursByWeekdayAndHour.mockResolvedValue([
      { equipmentId: 9, weekday: 1, hour: 9, hours: 2 },
    ]);

    const { equipment } = await getStats();

    expect(equipment[0]).toMatchObject({ id: '9', name: 'Microscope', removed: false, reservationCount: 2, totalHours: 2 });
    expect(equipment[1]).toEqual({
      id: '10',
      name: 'Centrifuge',
      removed: false,
      reservationCount: 0,
      totalHours: 0,
      hoursByWeekday: Array(7).fill(0),
      hoursByHour: Array(24).fill(0),
    });
  });

  it('marks equipment that has been removed', async () => {
    ReservationRepository.countForLab.mockResolvedValue([{ ...MICROSCOPE, active: false }]);

    const { equipment } = await getStats();

    expect(equipment[0].removed).toBe(true);
  });

  it('ignores hours for equipment that was not counted', async () => {
    ReservationRepository.hoursByWeekdayAndHour.mockResolvedValue([
      { equipmentId: 99, weekday: 1, hour: 9, hours: 2 },
    ]);

    const { equipment } = await getStats();

    expect(equipment).toHaveLength(1);
    expect(equipment[0].totalHours).toBe(0);
  });

  it('returns no equipment for an empty lab', async () => {
    ReservationRepository.countForLab.mockResolvedValue([]);

    const { equipment } = await getStats();

    expect(equipment).toEqual([]);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
  ])('uses UTC when the time zone is %s', async (_label, timeZone) => {
    const stats = await getStats({ timeZone });

    expect(stats.timeZone).toBe('UTC');
    expect(ReservationRepository.hoursByWeekdayAndHour).toHaveBeenCalledWith(
      expect.objectContaining({ timeZone: 'UTC' }),
    );
  });

  it.each([
    ['an unknown name', 'Not/AZone'],
    ['not text', ['UTC', 'UTC']],
  ])('rejects a time zone that is %s', async (_label, timeZone) => {
    await expect(getStats({ timeZone })).rejects.toMatchObject({ status: 400, code: 'INVALID_TIME_ZONE' });
    expect(ReservationRepository.countForLab).not.toHaveBeenCalled();
  });

  it('rejects a time zone that only the database does not recognize', async () => {
    ReservationRepository.hoursByWeekdayAndHour.mockRejectedValue(
      Object.assign(new Error('time zone not recognized'), { code: '22023' }),
    );

    await expect(getStats()).rejects.toMatchObject({ status: 400, code: 'INVALID_TIME_ZONE' });
  });

  it('passes other database errors through unchanged', async () => {
    const dbError = new Error('connection lost');
    ReservationRepository.countForLab.mockRejectedValue(dbError);

    await expect(getStats()).rejects.toBe(dbError);
  });

  it('rejects a lab the manager does not own', async () => {
    LabRepository.findOwnedBy.mockResolvedValue(null);

    await expect(getStats()).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(ReservationRepository.countForLab).not.toHaveBeenCalled();
  });
});

describe('GET /api/labs/:id/stats', () => {
  const app = createApp();

  function authCookie(id, role) {
    const { accessToken } = TokenService.issueTokens({ id, role });
    return `bt_access=${accessToken}`;
  }

  it('lets a manager see stats in their time zone (200)', async () => {
    const res = await request(app)
      .get('/api/labs/5/stats')
      .query({ tz: 'America/Chicago' })
      .set('Cookie', authCookie(MANAGER_ID, 'manager'));

    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({ weeks: STATS_WEEKS, timeZone: 'America/Chicago' });
    expect(res.body.stats.equipment[0].id).toBe('9');
  });

  it('does not let a member see stats (403)', async () => {
    const res = await request(app)
      .get('/api/labs/5/stats')
      .set('Cookie', authCookie(MEMBER_ID, 'member'));

    expect(res.status).toBe(403);
    expect(ReservationRepository.countForLab).not.toHaveBeenCalled();
  });

  it('requires the user to be signed in (401)', async () => {
    const res = await request(app).get('/api/labs/5/stats');

    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid time zone', async () => {
    const res = await request(app)
      .get('/api/labs/5/stats')
      .query({ tz: 'Not/AZone' })
      .set('Cookie', authCookie(MANAGER_ID, 'manager'));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TIME_ZONE');
  });

  it('returns 404 for a lab the manager does not own', async () => {
    LabRepository.findOwnedBy.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/labs/5/stats')
      .set('Cookie', authCookie(MANAGER_ID, 'manager'));

    expect(res.status).toBe(404);
  });
});
