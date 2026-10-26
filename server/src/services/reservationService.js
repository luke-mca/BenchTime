import { EquipmentRepository } from '../repositories/equipmentRepository.js';
import { ReservationRepository } from '../repositories/reservationRepository.js';
import { findAccessibleLabOrThrow, findOwnedLabOrThrow, parseId } from './labService.js';
import { ValidationError, NotFoundError, ConflictError } from '../errors.js';

//Longest single reservation allowed.
export const MAX_RESERVATION_HOURS = 6;

//How many weeks back the utilization statistics cover.
export const STATS_WEEKS = 4;

//Postgres error codes for the reservations_no_overlap and reservations_time_order constraints.
const EXCLUSION_VIOLATION = '23P01';
const CHECK_VIOLATION = '23514';
//Postgres error code for a time zone name it does not recognize.
const INVALID_PARAMETER_VALUE = '22023';

//How far in the past a start time can be. Covers picking the current minute in the form.
const START_GRACE_MS = 60 * 1000;

export function toPublicReservation(row, userId) {
  return {
    id: String(row.id),
    equipmentId: String(row.equipmentId),
    username: row.username,
    startTime: row.startTime,
    endTime: row.endTime,
    isMine: String(row.userId) === String(userId),
  };
}

//Returns a Date, or throws if the value is not a date string.
function parseTime(value, label) {
  const time = typeof value === 'string' ? new Date(value) : null;

  if (!time || Number.isNaN(time.getTime())) {
    throw new ValidationError(`${label} must be a valid date and time.`, 'INVALID_RESERVATION_TIME');
  }

  return time;
}

//Returns an IANA time zone name such as "America/Chicago", or UTC if none was given.
function parseTimeZone(value) {
  if (value === undefined || value === '') return 'UTC';

  try {
    if (typeof value !== 'string') throw new RangeError();
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    throw new ValidationError('Time zone must be a valid IANA time zone name.', 'INVALID_TIME_ZONE');
  }
}

//Parses and checks a reservation's start and end. Shared by booking and editing.
function parseRange(startTime, endTime) {
  const start = parseTime(startTime, 'Start time');
  const end = parseTime(endTime, 'End time');

  if (end <= start) {
    throw new ValidationError('The end time must be after the start time.', 'RESERVATION_END_BEFORE_START');
  }

  if (start.getTime() < Date.now() - START_GRACE_MS) {
    throw new ValidationError('A reservation cannot start in the past.', 'RESERVATION_IN_PAST');
  }

  if (end - start > MAX_RESERVATION_HOURS * 60 * 60 * 1000) {
    throw new ValidationError(
      `A reservation can be at most ${MAX_RESERVATION_HOURS} hours long.`,
      'RESERVATION_TOO_LONG',
    );
  }

  return { start, end };
}

//The database decides overlaps so two bookings made at the same moment cannot both succeed.
function toReservationError(error) {
  if (error.code === EXCLUSION_VIOLATION) {
    return new ConflictError(
      'That time overlaps an existing reservation. Pick a different time.',
      'RESERVATION_OVERLAP',
    );
  }
  if (error.code === CHECK_VIOLATION) {
    return new ValidationError('The end time must be after the start time.', 'RESERVATION_END_BEFORE_START');
  }
  return error;
}

async function findEquipmentOrThrow(labId, equipmentId) {
  const id = parseId(equipmentId);
  const equipment = id ? await EquipmentRepository.findActiveInLab(labId, id) : null;

  if (!equipment) {
    throw new NotFoundError('That equipment is not part of this lab.');
  }

  return equipment;
}

//Managers can use these in labs they own and members in labs they have been added to.
export const ReservationService = {
  //Lists the reservations for a piece of equipment that have not ended yet.
  async listReservations({ labId, equipmentId, user } = {}) {
    const lab = await findAccessibleLabOrThrow(labId, user);
    const equipment = await findEquipmentOrThrow(lab.id, equipmentId);

    const rows = await ReservationRepository.listUpcomingForEquipment(equipment.id);
    return rows.map((row) => toPublicReservation(row, user.id));
  },

  //Reserves a piece of equipment for the signed in user.
  async createReservation({ labId, equipmentId, startTime, endTime, user } = {}) {
    const lab = await findAccessibleLabOrThrow(labId, user);
    const { start, end } = parseRange(startTime, endTime);

    const id = parseId(equipmentId);
    let row;
    try {
      row = id
        ? await ReservationRepository.create({
            labId: lab.id,
            equipmentId: id,
            userId: user.id,
            startTime: start,
            endTime: end,
          })
        : null;
    } catch (error) {
      throw toReservationError(error);
    }

    if (!row) {
      throw new NotFoundError('That equipment is not part of this lab.');
    }

    return toPublicReservation(row, user.id);
  },

  //Changes the times of anyone's upcoming reservation in a lab the manager owns.
  async updateReservation({ labId, reservationId, startTime, endTime, ownerId } = {}) {
    const lab = await findOwnedLabOrThrow(labId, ownerId);
    const { start, end } = parseRange(startTime, endTime);

    const id = parseId(reservationId);
    let row;
    try {
      row = id
        ? await ReservationRepository.updateInLab({
            labId: lab.id,
            reservationId: id,
            startTime: start,
            endTime: end,
          })
        : null;
    } catch (error) {
      throw toReservationError(error);
    }

    if (!row) {
      throw new NotFoundError('That reservation does not exist.');
    }

    return toPublicReservation(row, ownerId);
  },

  //Utilization statistics for every piece of equipment in a lab the manager owns, over the last STATS_WEEKS weeks.
  //Weekdays and hours are in the caller's time. 
  async getUtilization({ labId, ownerId, timeZone } = {}) {
    const lab = await findOwnedLabOrThrow(labId, ownerId);
    const zone = parseTimeZone(timeZone);

    const to = new Date();
    const from = new Date(to.getTime() - STATS_WEEKS * 7 * 24 * 60 * 60 * 1000);

    let counts;
    let buckets;
    try {
      [counts, buckets] = await Promise.all([
        ReservationRepository.countForLab({ labId: lab.id, from, to }),
        ReservationRepository.hoursByWeekdayAndHour({ labId: lab.id, from, to, timeZone: zone }),
      ]);
    } catch (error) {
      //Node and Postgres ship different time zone lists, so a name Node accepted can still be rejected here.
      if (error.code === INVALID_PARAMETER_VALUE) {
        throw new ValidationError('Time zone must be a valid IANA time zone name.', 'INVALID_TIME_ZONE');
      }
      throw error;
    }

    const equipment = counts.map((row) => ({
      id: String(row.id),
      name: row.name,
      removed: !row.active,
      reservationCount: row.reservationCount,
      totalHours: 0,
      //Index 0 is Monday.
      hoursByWeekday: Array(7).fill(0),
      hoursByHour: Array(24).fill(0),
    }));

    const byId = new Map(equipment.map((item) => [item.id, item]));
    for (const bucket of buckets) {
      const item = byId.get(String(bucket.equipmentId));
      if (!item) continue;
      item.totalHours += bucket.hours;
      item.hoursByWeekday[bucket.weekday - 1] += bucket.hours;
      item.hoursByHour[bucket.hour] += bucket.hours;
    }

    return { from, to, weeks: STATS_WEEKS, timeZone: zone, equipment };
  },

  //Cancels an upcoming reservation. Members can only cancel their own; the lab's manager can cancel anyone's.
  async cancelReservation({ labId, reservationId, user } = {}) {
    const lab = await findAccessibleLabOrThrow(labId, user);

    const id = parseId(reservationId);
    let deleted = false;
    if (id) {
      deleted =
        user.role === 'manager'
          ? await ReservationRepository.deleteInLab({ labId: lab.id, reservationId: id })
          : await ReservationRepository.deleteOwn({ labId: lab.id, reservationId: id, userId: user.id });
    }

    if (!deleted) {
      throw new NotFoundError('That reservation does not exist.');
    }
  },
};
