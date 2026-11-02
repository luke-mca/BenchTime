import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AUTH_STATUS, AuthProvider, useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

const ALICE = { id: '42', username: 'alice', role: 'member' };
const BOB = { id: '43', username: 'bob', role: 'manager' };

function Probe() {
  const { status, user, login, register, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user ? `${user.username}:${user.role}` : 'none'}</p>
      <button type="button" onClick={() => login({ username: 'alice', password: 'correct-horse' })}>
        login
      </button>
      <button type="button" onClick={() => register({ username: 'bob', password: 'correct-horse', role: 'manager' })}>
        register
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

async function waitForStatus(status) {
  expect(await screen.findByText(status, { selector: '[data-testid="status"]' })).toBeInTheDocument();
}

beforeEach(() => {
  vi.resetAllMocks();
  api.me.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
  api.login.mockResolvedValue({ user: ALICE });
  api.register.mockResolvedValue({ user: BOB });
  api.logout.mockResolvedValue(null);
});

describe('AuthProvider', () => {
  it('starts out loading', () => {
    api.me.mockReturnValue(new Promise(() => {}));
    renderProvider();

    expect(screen.getByTestId('status')).toHaveTextContent(AUTH_STATUS.LOADING);
  });

  it('signs in the user the server already knows about', async () => {
    api.me.mockResolvedValue({ user: ALICE });
    renderProvider();

    await waitForStatus(AUTH_STATUS.SIGNED_IN);
    expect(screen.getByTestId('user')).toHaveTextContent('alice:member');
  });

  it('is signed out when the server has no session', async () => {
    renderProvider();

    await waitForStatus(AUTH_STATUS.SIGNED_OUT);
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('signs in after logging in', async () => {
    renderProvider();
    await waitForStatus(AUTH_STATUS.SIGNED_OUT);

    await userEvent.click(screen.getByRole('button', { name: 'login' }));

    expect(api.login).toHaveBeenCalledWith({ username: 'alice', password: 'correct-horse' });
    await waitForStatus(AUTH_STATUS.SIGNED_IN);
    expect(screen.getByTestId('user')).toHaveTextContent('alice:member');
  });

  it('signs in after registering', async () => {
    renderProvider();
    await waitForStatus(AUTH_STATUS.SIGNED_OUT);

    await userEvent.click(screen.getByRole('button', { name: 'register' }));

    expect(api.register).toHaveBeenCalledWith({ username: 'bob', password: 'correct-horse', role: 'manager' });
    await waitForStatus(AUTH_STATUS.SIGNED_IN);
    expect(screen.getByTestId('user')).toHaveTextContent('bob:manager');
  });

  it('signs out after logging out', async () => {
    api.me.mockResolvedValue({ user: ALICE });
    renderProvider();
    await waitForStatus(AUTH_STATUS.SIGNED_IN);

    await userEvent.click(screen.getByRole('button', { name: 'logout' }));

    expect(api.logout).toHaveBeenCalledOnce();
    await waitForStatus(AUTH_STATUS.SIGNED_OUT);
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('still signs out when the logout request fails', async () => {
    api.me.mockResolvedValue({ user: ALICE });
    api.logout.mockRejectedValue(new TypeError('Failed to fetch'));
    renderProvider();
    await waitForStatus(AUTH_STATUS.SIGNED_IN);

    await userEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitForStatus(AUTH_STATUS.SIGNED_OUT);
  });
});

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow('useAuth must be used inside <AuthProvider>.');
  });
});
