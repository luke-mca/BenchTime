import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireManager } from '../middleware/auth.js';

//File which contains endpoints for managing labs. 
export const labsRouter = Router();

//Longest lab name we accept. The column is text so this is only enforced here.
const MAX_LAB_NAME_LENGTH = 100;

//Mounting the middleware functions. 
labsRouter.use(requireAuth, requireManager);

/*
Sends one of our error responses.
Matches the { error: { message } } that the client's request() helper reads.
*/
function fail(res, status, message) {
  res.status(status).json({ error: { message } });
}

/*
Returns the id as a string, or null if it is not a positive integer. Ids are bigint
so a non numeric value would make PostgreSQL throw instead of giving a clean 404.
*/
function parseLabId(value) {
  return /^\d+$/.test(value) ? value : null;
}

/*
Loads a lab only if the given manager owns it.
Returns the lab row, or null if the lab does not exist or belongs to someone else.
*/
async function findOwnedLab(labId, ownerId) {
  const result = await pool.query(
    `SELECT id, name, created_at AS "createdAt"
       FROM labs
      WHERE id = $1 AND owner_id = $2`,
    [labId, ownerId],
  );

  return result.rows[0] ?? null;
}

//Lists the labs the signed in manager owns. Empty array if they have none yet.
labsRouter.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT id, name, created_at AS "createdAt"
       FROM labs
      WHERE owner_id = $1
      ORDER BY created_at DESC`,
    [req.user.id],
  );

  res.json({ labs: result.rows });
});

//Creates a lab owned by the signed in manager.
labsRouter.post('/', async (req, res) => {
  const { name } = req.body ?? {};

  if (typeof name !== 'string' || name.trim() === '') {
    return fail(res, 400, 'A lab name is required.');
  }

  const trimmed = name.trim();

  if (trimmed.length > MAX_LAB_NAME_LENGTH) {
    return fail(res, 400, `A lab name can be at most ${MAX_LAB_NAME_LENGTH} characters.`);
  }

  const result = await pool.query(
    `INSERT INTO labs (name, owner_id)
          VALUES ($1, $2)
       RETURNING id, name, created_at AS "createdAt"`,
    [trimmed, req.user.id],
  );

  res.status(201).json({ lab: result.rows[0] });
});

//Returns a single lab the signed in manager owns.
labsRouter.get('/:id', async (req, res) => {
  const labId = parseLabId(req.params.id);
  const lab = labId && (await findOwnedLab(labId, req.user.id));

  if (!lab) {
    return fail(res, 404, 'That lab does not exist.');
  }

  res.json({ lab });
});

//Lists the members who have been added to a lab the signed in manager owns.
labsRouter.get('/:id/members', async (req, res) => {
  const labId = parseLabId(req.params.id);

  if (!labId || !(await findOwnedLab(labId, req.user.id))) {
    return fail(res, 404, 'That lab does not exist.');
  }

  const result = await pool.query(
    `SELECT u.id, u.username, m.created_at AS "addedAt"
       FROM memberships m
       JOIN users u ON u.id = m.user_id
      WHERE m.lab_id = $1
      ORDER BY u.username`,
    [labId],
  );

  res.json({ members: result.rows });
});

//Adds a member to a lab the signed in manager owns using the members username. 
labsRouter.post('/:id/members', async (req, res) => {
  const labId = parseLabId(req.params.id);

  if (!labId || !(await findOwnedLab(labId, req.user.id))) {
    return fail(res, 404, 'That lab does not exist.');
  }

  const { username } = req.body ?? {};

  if (typeof username !== 'string' || username.trim() === '') {
    return fail(res, 400, 'A username is required.');
  }

  const trimmed = username.trim();

  //Matches users_username_lower_key so usernames are found regardless of casing.
  const userResult = await pool.query(
    'SELECT id, username, role FROM users WHERE lower(username) = lower($1)',
    [trimmed],
  );
  const member = userResult.rows[0];

  if (!member) {
    return fail(res, 404, `There is no user named "${trimmed}".`);
  }

  //The owner already has full access to the lab, so a membership row would be noise.
  if (member.id === req.user.id) {
    return fail(res, 400, 'You already own this lab.');
  }

  //Roles are exclusive so only member accounts can be added to a lab.
  if (member.role !== 'member') {
    return fail(res, 400, `${member.username} is a lab manager, not a member.`);
  }
  const insertResult = await pool.query(
    `INSERT INTO memberships (lab_id, user_id)
          VALUES ($1, $2)
     ON CONFLICT (lab_id, user_id) DO NOTHING
       RETURNING created_at AS "addedAt"`,
    [labId, member.id],
  );

  if (insertResult.rowCount === 0) {
    return fail(res, 409, `${member.username} is already a member of this lab.`);
  }

  res.status(201).json({
    member: {
      id: member.id,
      username: member.username,
      addedAt: insertResult.rows[0].addedAt,
    },
  });
});
