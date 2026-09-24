import { pool } from '../db/pool.js';

const COLUMNS = 'id, name, created_at AS "createdAt"';
const MEMBER_COLUMNS = 'l.id, l.name, l.created_at AS "createdAt"';

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

  //Lists every lab a member has been added to.
  async listByMember(userId) {
    const result = await pool.query(
      `SELECT ${MEMBER_COLUMNS}
         FROM labs l
         JOIN memberships m ON m.lab_id = l.id
        WHERE m.user_id = $1
        ORDER BY l.created_at DESC`,
      [userId],
    );
    return result.rows;
  },

  //Loads a lab only if the given member has been added to it.
  async findForMember(labId, userId) {
    const result = await pool.query(
      `SELECT ${MEMBER_COLUMNS}
         FROM labs l
         JOIN memberships m ON m.lab_id = l.id
        WHERE l.id = $1 AND m.user_id = $2`,
      [labId, userId],
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
