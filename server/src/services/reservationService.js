import { EquipmentRepository } from '../repositories/equipmentRepository.js';
import { ReservationRepository } from '../repositories/reservationRepository.js';
import { findAccessibleLabOrThrow, parseId } from './labService.js';
import { ValidationError, NotFoundError, ConflictError } from '../errors.js';

//Longest single reservation allowed.
export const MAX_RESERVATION_HOURS = 6;

//Postgres error codes for the reservations_no_overlap and reservations_time_order constraints.
const EXCLUSION_VIOLATION = '23P01';
const CHECK_VIOLATION = '23514';

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
      //The database decides overlaps so two bookings made at the same moment cannot both succeed.
      if (error.code === EXCLUSION_VIOLATION) {
        throw new ConflictError(
          'That time overlaps an existing reservation. Pick a different time.',
          'RESERVATION_OVERLAP',
        );
      }
      if (error.code === CHECK_VIOLATION) {
        throw new ValidationError('The end time must be after the start time.', 'RESERVATION_END_BEFORE_START');
      }
      throw error;
    }

    if (!row) {
      throw new NotFoundError('That equipment is not part of this lab.');
    }

    return toPublicReservation(row, user.id);
  },

  //Cancels one of the signed in user's own reservations.
  async cancelReservation({ labId, reservationId, user } = {}) {
    const lab = await findAccessibleLabOrThrow(labId, user);

    const id = parseId(reservationId);
    const deleted = id
      ? await ReservationRepository.deleteOwn({ labId: lab.id, reservationId: id, userId: user.id })
      : false;

    if (!deleted) {
      throw new NotFoundError('That reservation does not exist.');
    }
  },
};
