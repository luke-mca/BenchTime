import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm.jsx';
import { AUTH_STATUS, useAuth } from '../lib/AuthContext.jsx';

vi.mock('../lib/AuthContext.jsx', async (importOriginal) => ({
  ...(await importOriginal()),
  useAuth: vi.fn(),
}));

function renderLogin(entry = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/labs/:id" element={<p>Lab page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillAndSubmit(username = 'alice', password = 'correct-horse') {
  await userEvent.type(screen.getByLabelText('Username'), username);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Log In' }));
}

let login;

beforeEach(() => {
  vi.resetAllMocks();
  login = vi.fn().mockResolvedValue({ id: '42', username: 'alice', role: 'member' });
  useAuth.mockReturnValue({ status: AUTH_STATUS.SIGNED_OUT, login });
});

describe('LoginForm', () => {
  it('logs in with the entered credentials and goes home', async () => {
    renderLogin();

    await fillAndSubmit();

    expect(login).toHaveBeenCalledWith({ username: 'alice', password: 'correct-horse' });
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('returns to the page the user was trying to reach', async () => {
    renderLogin({ pathname: '/login', state: { from: { pathname: '/labs/5' } } });

    await fillAndSubmit();

    expect(await screen.findByText('Lab page')).toBeInTheDocument();
  });

  it('shows the server error and marks the fields invalid', async () => {
    login.mockRejectedValue(Object.assign(new Error('Invalid username or password.'), { status: 401 }));
    renderLogin();

    await fillAndSubmit('alice', 'wrong-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.');
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Log In' })).toBeEnabled();
  });

  it('shows a generic error when the server cannot be reached', async () => {
    login.mockRejectedValue(new TypeError('Failed to fetch'));
    renderLogin();

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('disables the button while logging in', async () => {
    login.mockReturnValue(new Promise(() => {}));
    renderLogin();

    await fillAndSubmit();

    expect(screen.getByRole('button', { name: 'Logging in…' })).toBeDisabled();
  });

  it('redirects a user who is already signed in', () => {
    useAuth.mockReturnValue({ status: AUTH_STATUS.SIGNED_IN, login });
    renderLogin();

    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('links to the sign up page', () => {
    renderLogin();

    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
  });
});
