import { config } from '../config.js';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from '../services/tokenService.js';

//Tokens are kept in httpOnly cookies so page scripts can never read them.

export const ACCESS_COOKIE = 'bt_access';
export const REFRESH_COOKIE = 'bt_refresh';

//The refresh token is only sent to the auth routes, not on every API call.
const REFRESH_PATH = '/api/auth';

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
  };
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions(),
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions(),
    path: REFRESH_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

//Options (other than maxAge) must match the ones used to set the cookie or the browser keeps it.
export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: REFRESH_PATH });
}
