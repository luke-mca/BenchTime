//File for exposing the basic server api. 
export async function request(path, options = {}) {
  const response = await fetch(path, {
    //Sends the session cookie which is how the server knows who is signed in. 
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
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
};
