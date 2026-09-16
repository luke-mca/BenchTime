//File for interacting with the basic server api.


//Just keeping this in memory for now as its easier to test. 
let userId = '';

export function getUserId() {
  return userId;
}

export function setUserId(id) {
  userId = id ?? '';
}

//Adds the entered id to a path, leaving the path alone if nothing was entered.
function withUser(path) {
  const userId = getUserId();
  if (!userId) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}userId=${encodeURIComponent(userId)}`;
}

export async function request(path, options = {}) {
  const response = await fetch(withUser(path), {
    //Sends the session cookie which is how the server knows who is signed in.
    credentials: 'include',
    ...options,
    //Spread last so a caller's own headers do not wipe out the defaults.
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
  }

  return body;
}

export const api = {
  health: () => request('/api/health'),
  healthDb: () => request('/api/health/db'),

  //Check the entered ID to verify the identity of the user. 
  me: () => request('/api/me'),

  listLabs: () => request('/api/labs'),

  createLab: (name) =>
    request('/api/labs', { method: 'POST', body: JSON.stringify({ name }) }),

  getLab: (labId) => request(`/api/labs/${labId}`),

  listMembers: (labId) => request(`/api/labs/${labId}/members`),

  addMember: (labId, username) =>
    request(`/api/labs/${labId}/members`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
};
