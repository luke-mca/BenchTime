import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, request } from '../lib/api.js';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: body === undefined ? async () => { throw new SyntaxError('Unexpected end of JSON input'); } : async () => body,
  };
}

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('returns the response body on success', async () => {
    fetchMock.mockResolvedValue(response(200, { status: 'ok' }));

    await expect(request('/api/health')).resolves.toEqual({ status: 'ok' });
  });

  it('sends cookies and a JSON content type', async () => {
    fetchMock.mockResolvedValue(response(200, {}));

    await request('/api/health');

    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  it('keeps the default headers when the caller adds their own', async () => {
    fetchMock.mockResolvedValue(response(200, {}));

    await request('/api/health', { headers: { 'X-Test': '1' } });

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json', 'X-Test': '1' });
  });

  it('throws an ApiError with the server message, status and code', async () => {
    fetchMock.mockResolvedValue(response(409, { error: { code: 'USERNAME_TAKEN', message: 'That username is already taken.' } }));

    const error = await request('/api/auth/register').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'That username is already taken.', status: 409, code: 'USERNAME_TAKEN' });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(response(502));

    await expect(request('/api/health')).rejects.toMatchObject({ message: 'Request failed (502)', status: 502 });
  });

  it('returns null for a successful response with no body', async () => {
    fetchMock.mockResolvedValue(response(204));

    await expect(request('/api/auth/logout')).resolves.toBeNull();
  });
});

describe('token refresh', () => {
  it('refreshes the tokens and retries once after a 401', async () => {
    fetchMock
      .mockResolvedValueOnce(response(401, { error: { code: 'UNAUTHORIZED', message: 'Expired.' } }))
      .mockResolvedValueOnce(response(200, { user: {} }))
      .mockResolvedValueOnce(response(200, { labs: [] }));

    await expect(request('/api/labs')).resolves.toEqual({ labs: [] });

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/api/labs', '/api/auth/refresh', '/api/labs']);
    expect(fetchMock.mock.calls[1][1]).toEqual({ method: 'POST', credentials: 'include' });
  });

  it('throws the 401 when the refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(response(401, { error: { code: 'UNAUTHORIZED', message: 'Expired.' } }))
      .mockResolvedValueOnce(response(401, { error: { code: 'UNAUTHORIZED', message: 'Please log in again.' } }));

    await expect(request('/api/labs')).rejects.toMatchObject({ status: 401, message: 'Expired.' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws the 401 when the refresh request cannot be sent', async () => {
    fetchMock
      .mockResolvedValueOnce(response(401, { error: { code: 'UNAUTHORIZED', message: 'Expired.' } }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(request('/api/labs')).rejects.toMatchObject({ status: 401 });
  });

  it.each(['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'])(
    'does not refresh for %s',
    async (path) => {
      fetchMock.mockResolvedValue(response(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid.' } }));

      await expect(request(path, { method: 'POST' })).rejects.toMatchObject({ status: 401 });
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it('shares one refresh between requests that fail at the same time', async () => {
    let signedIn = false;
    fetchMock.mockImplementation(async (path) => {
      if (path === '/api/auth/refresh') {
        await new Promise((resolve) => setTimeout(resolve, 0));
        signedIn = true;
        return response(200, { user: {} });
      }
      return signedIn ? response(200, { path }) : response(401, { error: { code: 'UNAUTHORIZED', message: 'Expired.' } });
    });

    await expect(Promise.all([request('/api/labs'), request('/api/auth/me')])).resolves.toEqual([
      { path: '/api/labs' },
      { path: '/api/auth/me' },
    ]);

    const refreshCalls = fetchMock.mock.calls.filter(([path]) => path === '/api/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
  });
});

describe('api', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(response(200, {}));
  });

  function lastCall() {
    const [path, options] = fetchMock.mock.calls.at(-1);
    return { path, method: options.method ?? 'GET', body: options.body && JSON.parse(options.body) };
  }

  it.each([
    ['register', () => api.register({ username: 'alice', password: 'pw', role: 'member', extra: 'x' }), 'POST', '/api/auth/register', { username: 'alice', password: 'pw', role: 'member' }],
    ['login', () => api.login({ username: 'alice', password: 'pw' }), 'POST', '/api/auth/login', { username: 'alice', password: 'pw' }],
    ['logout', () => api.logout(), 'POST', '/api/auth/logout', undefined],
    ['me', () => api.me(), 'GET', '/api/auth/me', undefined],
    ['createLab', () => api.createLab('Chem Lab'), 'POST', '/api/labs', { name: 'Chem Lab' }],
    ['deleteLab', () => api.deleteLab('5'), 'DELETE', '/api/labs/5', undefined],
    ['addMember', () => api.addMember('5', 'alice'), 'POST', '/api/labs/5/members', { username: 'alice' }],
    ['removeMember', () => api.removeMember('5', '8'), 'DELETE', '/api/labs/5/members/8', undefined],
    ['addEquipment', () => api.addEquipment('5', { name: 'Microscope', description: 'Zeiss' }), 'POST', '/api/labs/5/equipment', { name: 'Microscope', description: 'Zeiss' }],
    ['removeEquipment', () => api.removeEquipment('5', '9'), 'DELETE', '/api/labs/5/equipment/9', undefined],
    ['createReservation', () => api.createReservation('5', '9', { startTime: 's', endTime: 'e' }), 'POST', '/api/labs/5/equipment/9/reservations', { startTime: 's', endTime: 'e' }],
    ['updateReservation', () => api.updateReservation('5', '100', { startTime: 's', endTime: 'e' }), 'PATCH', '/api/labs/5/reservations/100', { startTime: 's', endTime: 'e' }],
    ['cancelReservation', () => api.cancelReservation('5', '100'), 'DELETE', '/api/labs/5/reservations/100', undefined],
  ])('%s calls the right endpoint', async (_name, call, method, path, body) => {
    await call();

    expect(lastCall()).toEqual({ path, method, body });
  });

  it('encodes ids in the URL', async () => {
    await api.getLab('a/b?c');

    expect(lastCall().path).toBe('/api/labs/a%2Fb%3Fc');
  });

  it('sends the browser time zone when loading stats', async () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    await api.getStats('5');

    expect(lastCall().path).toBe(`/api/labs/5/stats?tz=${encodeURIComponent(zone)}`);
  });
});
