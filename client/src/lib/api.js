//File for exposing the basic server api.

//Error thrown for any non-2xx response. `code` is the server's error code (e.g. USERNAME_TAKEN).
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

//Auth routes that should never trigger a token refresh (they either issue tokens or are the refresh itself).
const NO_REFRESH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'];

//Shared so several requests failing at once only refresh once.
let refreshPromise = null;

function refreshTokens() {
  refreshPromise ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function send(path, options) {
  return fetch(path, {
    ...options,
    //Sends the auth cookies, which is how the server knows who is signed in.
    //The tokens are httpOnly, so this code never sees them.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
}

export async function request(path, options = {}) {
  let response = await send(path, options);

  //The access token lasts 15 minutes. When it expires, swap the refresh token for a new one and retry once.
  if (response.status === 401 && !NO_REFRESH_PATHS.includes(path) && (await refreshTokens())) {
    response = await send(path, options);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      body?.error?.code,
    );
  }

  return body;
}

function post(path, data) {
  return request(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });
}

export const api = {
  health: () => request('/api/health'),
  healthDb: () => request('/api/health/db'),

  register: ({ username, password, role }) => post('/api/auth/register', { username, password, role }),
  login: ({ username, password }) => post('/api/auth/login', { username, password }),
  logout: () => post('/api/auth/logout'),
  me: () => request('/api/auth/me'),
};
