import { Link, useNavigate } from 'react-router-dom';
import { AUTH_STATUS, useAuth } from '../lib/AuthContext.jsx';

const ROLE_LABELS = { member: 'Member', manager: 'Lab Manager' };

export function NavBar() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-bold text-indigo-700">
          BenchTime
        </Link>

        {status === AUTH_STATUS.SIGNED_IN && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              {user.username} <span className="text-gray-400">· {ROLE_LABELS[user.role]}</span>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded px-3 py-1.5 text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              Log Out
            </button>
          </div>
        )}

        {status === AUTH_STATUS.SIGNED_OUT && (
          <div className="flex items-center gap-2 text-sm">
            <Link
              to="/login"
              className="rounded px-3 py-1.5 text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="rounded bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
