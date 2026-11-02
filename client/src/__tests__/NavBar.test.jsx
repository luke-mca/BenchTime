import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NavBar } from '../components/NavBar.jsx';
import { AUTH_STATUS, useAuth } from '../lib/AuthContext.jsx';

vi.mock('../lib/AuthContext.jsx', async (importOriginal) => ({
  ...(await importOriginal()),
  useAuth: vi.fn(),
}));

function renderNavBar(startAt = '/') {
  return render(
    <MemoryRouter initialEntries={[startAt]}>
      <NavBar />
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="*" element={<p>Other page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('NavBar', () => {
  it('links the logo to the home page', () => {
    useAuth.mockReturnValue({ status: AUTH_STATUS.LOADING, user: null, logout: vi.fn() });
    renderNavBar();

    expect(screen.getByRole('link', { name: 'BenchTime' })).toHaveAttribute('href', '/');
  });

  it.each([
    ['member', 'Member'],
    ['manager', 'Lab Manager'],
  ])('shows the signed in %s and their role', (role, label) => {
    useAuth.mockReturnValue({ status: AUTH_STATUS.SIGNED_IN, user: { username: 'alice', role }, logout: vi.fn() });
    renderNavBar();

    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText(`· ${label}`)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log In' })).not.toBeInTheDocument();
  });

  it('logs out and returns to the home page', async () => {
    const logout = vi.fn().mockResolvedValue();
    useAuth.mockReturnValue({ status: AUTH_STATUS.SIGNED_IN, user: { username: 'alice', role: 'member' }, logout });
    renderNavBar('/labs/5');

    expect(screen.getByText('Other page')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Log Out' }));

    expect(logout).toHaveBeenCalledOnce();
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('shows log in and sign up links when signed out', () => {
    useAuth.mockReturnValue({ status: AUTH_STATUS.SIGNED_OUT, user: null, logout: vi.fn() });
    renderNavBar();

    expect(screen.getByRole('link', { name: 'Log In' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute('href', '/register');
    expect(screen.queryByRole('button', { name: 'Log Out' })).not.toBeInTheDocument();
  });

  it('shows neither while the session is loading', () => {
    useAuth.mockReturnValue({ status: AUTH_STATUS.LOADING, user: null, logout: vi.fn() });
    renderNavBar();

    expect(screen.queryByRole('link', { name: 'Log In' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log Out' })).not.toBeInTheDocument();
  });
});
