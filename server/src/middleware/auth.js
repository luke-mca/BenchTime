import { TokenService } from '../services/tokenService.js';
import { UnauthorizedError, ForbiddenError } from '../errors.js';
import { ACCESS_COOKIE } from '../utils/authCookies.js';

//Permission checks. Every protected route uses these; hiding UI on the client is never the control.

//Requires a valid access token. Sets req.user = { id, role }.
export function requireAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) {
    return next(new UnauthorizedError());
  }

  try {
    const payload = TokenService.verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError('Your session has expired. Please log in again.'));
  }
}

//Requires the signed-in user to have one of the given roles. Use after requireAuth.
//  router.post('/', requireAuth, requireRole('manager'), handler)
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}
