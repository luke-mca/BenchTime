import { pool } from '../db/pool.js';

const COLUMNS = 'id, name, description, created_at AS "createdAt"';

export const EquipmentRepository = {
  //Lists the active equipment in a lab. Removed equipment is kept for reservation history but not shown.
  async listActiveByLab(labId) {
    const result = await pool.query(
      `SELECT ${COLUMNS} FROM equipment WHERE lab_id = $1 AND active ORDER BY lower(name)`,
      [labId],
    );
    return result.rows;
  },

  //Adds a piece of equipment to a lab. Returns the new equipment.
  async create({ labId, name, description }) {
    const result = await pool.query(
      `INSERT INTO equipment (lab_id, name, description)
            VALUES ($1, $2, $3)
         RETURNING ${COLUMNS}`,
      [labId, name, description],
    );
    return result.rows[0];
  },

  //Soft deletes a piece of equipment so its reservations survive for usage statistics.
  //Returns false if it is not active equipment in that lab.
  async deactivate(labId, equipmentId) {
    const result = await pool.query(
      'UPDATE equipment SET active = false WHERE id = $1 AND lab_id = $2 AND active',
      [equipmentId, labId],
    );
    return result.rowCount > 0;
  },
};
