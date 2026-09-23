import { pool } from '../db/pool.js';

//The only module that queries the labs and memberships tables directly.
const COLUMNS = 'id, name, created_at AS "createdAt"';

export const LabRepository = {
  //Lists every lab that a manager owns. 
  async listByOwner(ownerId) {
    const result = await pool.query(
      `SELECT ${COLUMNS} FROM labs WHERE owner_id = $1 ORDER BY created_at DESC`,
      [ownerId],
    );
    return result.rows;
  },

  //Loads a lab only if the given manager owns it.
  async findOwnedBy(labId, ownerId) {
    const result = await pool.query(
      `SELECT ${COLUMNS} FROM labs WHERE id = $1 AND owner_id = $2`,
      [labId, ownerId],
    );
    return result.rows[0] ?? null;
  },

  //Lists all of the members that belong to a certain lab.
  async listMembers(labId) {
    const result = await pool.query(
      `SELECT u.id, u.username, m.created_at AS "addedAt"
         FROM memberships m
         JOIN users u ON u.id = m.user_id
        WHERE m.lab_id = $1
        ORDER BY u.username`,
      [labId],
    );
    return result.rows;
  },

  //Adds a member to a lab. Returns the new membership.
  async addMember(labId, userId) {
    const result = await pool.query(
      `INSERT INTO memberships (lab_id, user_id)
            VALUES ($1, $2)
       ON CONFLICT (lab_id, user_id) DO NOTHING
         RETURNING created_at AS "addedAt"`,
      [labId, userId],
    );
    return result.rows[0] ?? null;
  },

  //Removes a member from a lab. Returns false if they were not a member.
  async removeMember(labId, userId) {
    const result = await pool.query(
      'DELETE FROM memberships WHERE lab_id = $1 AND user_id = $2',
      [labId, userId],
    );
    return result.rowCount > 0;
  },

  //Deletes a lab, but only if the given manager owns it.
  async deleteOwnedBy(labId, ownerId) {
    const result = await pool.query(
      'DELETE FROM labs WHERE id = $1 AND owner_id = $2',
      [labId, ownerId],
    );
    return result.rowCount > 0;
  },

  //Creates a lab for a manager.
  async createLab({ name, ownerId }) {
    const result = await pool.query(
      `INSERT INTO labs (name, owner_id) VALUES ($1, $2) RETURNING ${COLUMNS}`,
      [name, ownerId],
    );
    return result.rows[0];
  },
};
