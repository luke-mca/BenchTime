import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RegisterForm } from '../components/RegisterForm.jsx';
import { AUTH_STATUS, useAuth } from '../lib/AuthContext.jsx';

vi.mock('../lib/AuthContext.jsx', async (importOriginal) => ({
  ...(await importOriginal()),
  useAuth: vi.fn(),
}));

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterForm />} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillAndSubmit(username = 'alice', password = 'correct-horse') {
  await userEvent.type(screen.getByLabelText('Username'), username);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
}

let register;

beforeEach(() => {
  vi.resetAllMocks();
  register = vi.fn().mockResolvedValue({ id: '42', username: 'alice', role: 'member' });
  useAuth.mockReturnValue({ status: AUTH_STATUS.SIGNED_OUT, register });
});

describe('RegisterForm', () => {
  it('selects the member role by default', () => {
    renderRegister();

    expect(screen.getByRole('radio', { name: /Member/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Lab Manager/ })).not.toBeChecked();
  });

  it('registers a member and goes home', async () => {
    renderRegister();

    await fillAndSubmit();

    expect(register).toHaveBeenCalledWith({ username: 'alice', password: 'correct-horse', role: 'member' });
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('registers a lab manager when that role is picked', async () => {
    renderRegister();

    await userEvent.click(screen.getByRole('radio', { name: /Lab Manager/ }));
    await fillAndSubmit();

    expect(register).toHaveBeenCalledWith(expect.objectContaining({ role: 'manager' }));
  });

  it('shows the server error when the username is taken', async () => {
    register.mockRejectedValue(Object.assign(new Error('That username is already taken.'), { status: 409 }));
    renderRegister();

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('That username is already taken.');
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeEnabled();
  });

  it('shows a generic error when the server cannot be reached', async () => {
    register.mockRejectedValue(new TypeError('Failed to fetch'));
    renderRegister();

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('disables the button while creating the account', async () => {
    register.mockReturnValue(new Promise(() => {}));
    renderRegister();

    await fillAndSubmit();

    expect(screen.getByRole('button', { name: 'Creating account…' })).toBeDisabled();
  });

  it('shows the input hints', () => {
    renderRegister();

    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('3–32 characters: letters, numbers, _ . -');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('At least 8 characters.');
  });

  it('redirects a user who is already signed in', () => {
    useAuth.mockReturnValue({ status: AUTH_STATUS.SIGNED_IN, register });
    renderRegister();

    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('links to the log in page', () => {
    renderRegister();

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });
});
