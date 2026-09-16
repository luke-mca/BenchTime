import { pool } from '../db/pool.js';
import { config } from '../config.js';

/*
Looks up the user a request says it is.
req: the incoming request.
Returns { id, username, role } or null if the request did not name a real user.
*/
async function resolveUser(req) {
  //Identifying yourself by id like this must never be honored in production.
  if (config.env === 'production') {
    return null;
  }

  const rawId = req.query.userId;

  //users.id is a bigint, so anything non numeric would make PostgreSQL throw
  //before we could return a clean 401.
  if (typeof rawId !== 'string' || !/^\d+$/.test(rawId)) {
    return null;
  }

  const result = await pool.query(
    'SELECT id, username, role FROM users WHERE id = $1',
    [rawId],
  );

  return result.rows[0] ?? null;
}

/*
Sends one of our error responses.
Matches the { error: { message } } shape the client's request() helper reads.
*/
function deny(res, status, message) {
  res.status(status).json({ error: { message } });
}

/*
Rejects the request with a 401 unless it names a real user.
On success sets req.user to { id, username, role } for later middleware and handlers.
*/
export async function requireAuth(req, res, next) {
  const user = await resolveUser(req);

  if (!user) {
    //Says which id failed, since the usual cause is a row that is not in the table.
    const attempted = config.env === 'production' ? undefined : req.query.userId;

    return deny(
      res,
      401,
      attempted
        ? `There is no user with id ${attempted}.`
        : 'Enter the id of a manager account to continue.',
    );
  }

  req.user = user;
  next();
}

/*
Rejects the request with a 403 unless it is acting as a manager.
Meant to run after requireAuth but re-checks for a user so that forgetting to
chain it can never turn into an accidental bypass.
*/
export function requireManager(req, res, next) {
  if (!req.user) {
    return deny(res, 401, 'Enter the id of a manager account to continue.');
  }

  if (req.user.role !== 'manager') {
    return deny(res, 403, `${req.user.username} is not a lab manager.`);
  }

  next();
}
