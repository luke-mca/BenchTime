import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AUTH_STATUS, useAuth } from '../lib/AuthContext.jsx';
import { FormError, FormField, SubmitButton } from './FormField.jsx';

//Calls POST /api/auth/login. One status value, same as Workshop 7's LoginForm.
const STATES = { IDLE: 'idle', SUBMITTING: 'submitting' };
const ERROR_ID = 'login-error';

export function LoginForm() {
  const { status: authStatus, login } = useAuth();
  const navigate = useNavigate();
  //RequireAuth passes the page the user was trying to reach.
  const redirectTo = useLocation().state?.from?.pathname ?? '/';
  const [status, setStatus] = useState(STATES.IDLE);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  if (authStatus === AUTH_STATUS.SIGNED_IN && status === STATES.IDLE) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(STATES.SUBMITTING);
    setErrorMessage(null);

    try {
      await login({ username, password });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setErrorMessage(error.status ? error.message : 'Something went wrong. Please try again.');
      setStatus(STATES.IDLE);
    }
  }

  const errorId = errorMessage ? ERROR_ID : undefined;

  return (
    <div className="mx-auto max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Log in</h1>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        <FormField
          id="login-username"
          label="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          errorId={errorId}
          required
        />
        <FormField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          errorId={errorId}
          required
        />

        <FormError id={ERROR_ID} message={errorMessage} />

        <SubmitButton busy={status === STATES.SUBMITTING} busyLabel="Logging in…">
          Log In
        </SubmitButton>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        No account?{' '}
        <Link to="/register" className="font-medium text-indigo-600 underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
