import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

/*
Shows one lab the manager owns and lets them add members by username (US-8).
Lives at /labs/:labId.
*/
export default function LabPage() {
  const { labId } = useParams();
  const [lab, setLab] = useState(null);
  const [members, setMembers] = useState([]);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');

    Promise.all([api.getLab(labId), api.listMembers(labId)])
      .then(([labBody, membersBody]) => {
        setLab(labBody.lab);
        setMembers(membersBody.members);
      })
      .catch((err) => setError(err.message));
  }, [labId]);

  async function handleAddMember(event) {
    event.preventDefault();
    setError('');

    try {
      const body = await api.addMember(labId, username);
      setMembers((current) => [...current, body.member]);
      setUsername('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Link to="/labs">Back to my labs</Link>

      <h2>{lab ? lab.name : 'Loading...'}</h2>

      {error && <p className="status error">{error}</p>}

      <h3>Members</h3>

      {members.length === 0 ? (
        <p>No members yet.</p>
      ) : (
        <ul>
          {members.map((member) => (
            <li key={member.id}>{member.username}</li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAddMember}>
        <label htmlFor="member-username">Add member by username</label>{' '}
        <input
          id="member-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />{' '}
        <button type="submit">Add member</button>
      </form>
    </>
  );
}
