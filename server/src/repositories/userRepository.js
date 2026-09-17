import { pool } from '../db/pool.js';

//The only module that queries the users table directly.

const COLUMNS = 'id, username, password_hash, role';

export const UserRepository = {
  //Case-insensitive to match the users_username_lower_key unique index.
  async findByUsername(username) {
    const result = await pool.query(
      `SELECT ${COLUMNS} FROM users WHERE lower(username) = lower($1)`,
      [username],
    );
    return result.rows[0] ?? null;
  },

  async findById(id) {
    const result = await pool.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  },

  async create({ username, passwordHash, role }) {
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
      [username, passwordHash, role],
    );
    return result.rows[0];
  },
};
