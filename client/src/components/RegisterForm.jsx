import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AUTH_STATUS, useAuth } from '../lib/AuthContext.jsx';
import { FormError, FormField, SubmitButton } from './FormField.jsx';

//Calls POST /api/auth/register, which also signs the new user in (US-1, US-6).
const STATES = { IDLE: 'idle', SUBMITTING: 'submitting' };
const ERROR_ID = 'register-error';

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member', description: 'Reserve equipment in labs you are added to.' },
  { value: 'manager', label: 'Lab Manager', description: 'Create labs, add equipment, and add members.' },
];

export function RegisterForm() {
  const { status: authStatus, register } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(STATES.IDLE);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [errorMessage, setErrorMessage] = useState(null);

  if (authStatus === AUTH_STATUS.SIGNED_IN && status === STATES.IDLE) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(STATES.SUBMITTING);
    setErrorMessage(null);

    try {
      await register({ username, password, role });
      navigate('/', { replace: true });
    } catch (error) {
      //The server's message says why (NFR-6), e.g. "That username is already taken."
      setErrorMessage(error.status ? error.message : 'Something went wrong. Please try again.');
      setStatus(STATES.IDLE);
    }
  }

  const errorId = errorMessage ? ERROR_ID : undefined;

  return (
    <div className="mx-auto max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Create an account</h1>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        <fieldset>
          <legend className="text-sm font-medium text-gray-700">I am a…</legend>
          <div className="mt-2 space-y-2">
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer gap-3 rounded border border-gray-300 p-3 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50"
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 accent-indigo-600"
                />
                <span>
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-gray-500">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <FormField
          id="register-username"
          label="Username"
          autoComplete="username"
          hint="3–32 characters: letters, numbers, _ . -"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          errorId={errorId}
          required
        />
        <FormField
          id="register-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          errorId={errorId}
          required
        />

        <FormError id={ERROR_ID} message={errorMessage} />

        <SubmitButton busy={status === STATES.SUBMITTING} busyLabel="Creating account…">
          Sign Up
        </SubmitButton>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-indigo-600 underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
