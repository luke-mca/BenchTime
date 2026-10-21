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

  //Lists every piece of equipment in a lab with how many reservations overlap [from, to).
  //Removed equipment is only listed if it was reserved in that window.
  async countForLab({ labId, from, to }) {
    const result = await pool.query(
      `SELECT e.id, e.name, e.active, count(r.id)::int AS "reservationCount"
         FROM equipment e
         LEFT JOIN reservations r
           ON r.equipment_id = e.id AND r.start_time < $3 AND r.end_time > $2
        WHERE e.lab_id = $1
        GROUP BY e.id
       HAVING e.active OR count(r.id) > 0
        ORDER BY lower(e.name), e.id`,
      [labId, from, to],
    );
    return result.rows;
  },

  //Reserved hours in a lab during [from, to), split by equipment, weekday and hour of the day in the given time zone.
  async hoursByWeekdayAndHour({ labId, from, to, timeZone }) {
    const result = await pool.query(
      `WITH clipped AS (
         SELECT r.equipment_id,
                greatest(r.start_time, $2) AT TIME ZONE $4 AS s,
                least(r.end_time, $3) AT TIME ZONE $4 AS e
           FROM reservations r
           JOIN equipment eq ON eq.id = r.equipment_id
          WHERE eq.lab_id = $1 AND r.start_time < $3 AND r.end_time > $2
       )
       SELECT c.equipment_id AS "equipmentId",
              extract(isodow FROM h)::int AS weekday,
              extract(hour FROM h)::int AS hour,
              sum(extract(epoch FROM least(c.e, h + interval '1 hour') - greatest(c.s, h)) / 3600)::float8 AS hours
         FROM clipped c
        CROSS JOIN LATERAL generate_series(
                date_trunc('hour', c.s), c.e - interval '1 microsecond', interval '1 hour') AS h
        GROUP BY 1, 2, 3`,
      [labId, from, to, timeZone],
    );
    return result.rows;
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
