import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

/*
Lists the labs the signed in manager owns and lets them create a new one (US-7).
Lives at /labs.
*/
export default function LabsPage() {
  const [labs, setLabs] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listLabs()
      .then((body) => setLabs(body.labs))
      .catch((err) => setError(err.message));
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setError('');

    try {
      const body = await api.createLab(name);
      //The report's workflow takes the manager straight to the lab they just made.
      navigate(`/labs/${body.lab.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h2>My labs</h2>

      {error && <p className="status error">{error}</p>}
      {labs === null && !error && <p>Loading...</p>}

      {labs !== null && labs.length === 0 && <p>You have not created any labs yet.</p>}

      {labs !== null && labs.length > 0 && (
        <ul>
          {labs.map((lab) => (
            <li key={lab.id}>
              <Link to={`/labs/${lab.id}`}>{lab.name}</Link>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate}>
        <label htmlFor="lab-name">New lab name</label>{' '}
        <input
          id="lab-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />{' '}
        <button type="submit">Create lab</button>
      </form>
    </>
  );
}
