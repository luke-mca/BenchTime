import { useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, setUserId } from './lib/api.js';
import LabsPage from './pages/LabsPage.jsx';
import LabPage from './pages/LabPage.jsx';

//This page is temporary until the login system is fully built.
export default function App() {
  //The confirmed manager, or null while nobody is acting yet.
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  /*
  Checks an id against the database and takes it into use if it is good.
  id: the id that was entered.
  */
  async function useId(id) {
    setChecking(true);
    setError('');
    //Stored first so the request below sends it.
    setUserId(id);

    try {
      const body = await api.me();
      setUser(body.user);
    } catch (err) {
      //Invalid id
      setUserId('');
      setUser(null);
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    useId(new FormData(event.target).get('userId').trim());
  }

  function handleChangeUser() {
    setUserId('');
    setUser(null);
    setError('');
    //Off any lab page, since the next user may not own it.
    navigate('/labs');
  }

  return (
    <main>
      <h1>BenchTime</h1>
      <p className="subtitle">Lab equipment reservation system</p>

      {checking && <p>Checking id...</p>}

      {/* Nothing else is shown until an id has been confirmed. */}
      {!checking && !user && (
        <form onSubmit={handleSubmit}>
          <p>Enter the id of a manager account to continue.</p>

          {error && <p className="status error">{error}</p>}

          <label htmlFor="user-id">Manager id</label>{' '}
          <input id="user-id" name="userId" autoFocus />{' '}
          <button type="submit">Continue</button>
        </form>
      )}

      {!checking && user && (
        <>
          <p>
            Acting as {user.username}.{' '}
            <button type="button" onClick={handleChangeUser}>
              Change
            </button>
          </p>

          <hr />

          <Routes>
            <Route path="/labs" element={<LabsPage key={user.id} />} />
            <Route path="/labs/:labId" element={<LabPage />} />
            {/* Anything else lands on the lab list. */}
            <Route path="*" element={<Navigate to="/labs" replace />} />
          </Routes>
        </>
      )}
    </main>
  );
}
