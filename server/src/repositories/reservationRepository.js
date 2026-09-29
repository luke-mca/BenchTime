import { pool } from '../db/pool.js';

//Expects the reservation aliased as r and the user who booked it as u.
const COLUMNS = `r.id, r.equipment_id AS "equipmentId", r.user_id AS "userId", u.username,
  r.start_time AS "startTime", r.end_time AS "endTime", r.created_at AS "createdAt"`;

export const ReservationRepository = {
  //Lists reservations for a piece of equipment that have not ended yet, soonest first.
  async listUpcomingForEquipment(equipmentId) {
    const result = await pool.query(
      `SELECT ${COLUMNS}
         FROM reservations r
         JOIN users u ON u.id = r.user_id
        WHERE r.equipment_id = $1 AND r.end_time > now()
        ORDER BY r.start_time`,
      [equipmentId],
    );
    return result.rows;
  },

  //Books active equipment in a lab. Returns null if the equipment is not active in that lab.
  //Overlaps are rejected by the reservations_no_overlap constraint, not checked here.
  async create({ labId, equipmentId, userId, startTime, endTime }) {
    const result = await pool.query(
      `WITH inserted AS (
         INSERT INTO reservations (equipment_id, user_id, start_time, end_time)
         SELECT e.id, $3, $4, $5
           FROM equipment e
          WHERE e.id = $1 AND e.lab_id = $2 AND e.active
         RETURNING *
       )
       SELECT ${COLUMNS} FROM inserted r JOIN users u ON u.id = r.user_id`,
      [equipmentId, labId, userId, startTime, endTime],
    );
    return result.rows[0] ?? null;
  },

  //Deletes the user's own reservation in a lab if it has not ended. Past ones are kept for usage statistics.
  //Returns false if nothing matched.
  async deleteOwn({ labId, reservationId, userId }) {
    const result = await pool.query(
      `DELETE FROM reservations r
        USING equipment e
        WHERE r.id = $1 AND r.user_id = $2 AND e.id = r.equipment_id AND e.lab_id = $3
          AND r.end_time > now()`,
      [reservationId, userId, labId],
    );
    return result.rowCount > 0;
  },
};
