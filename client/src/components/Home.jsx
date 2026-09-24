import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { FormError, FormField, SubmitButton } from './FormField.jsx';

const STATES = { IDLE: 'idle', SUBMITTING: 'submitting' };
const ERROR_ID = 'create-lab-error';

export function Home() {
  const { user } = useAuth();

  return (
    <section>
      <h1 className="text-2xl font-semibold">Your labs</h1>
      {user.role === 'manager' ? <ManagerLabs /> : <MemberLabs />}
    </section>
  );
}

//Makes it so that a member can see a similar list to the lab managerA(i.e. the labs they have been added to) 
//but they cannot edit these. 
function MemberLabs() {
  const [labs, setLabs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .listLabs()
      .then(({ labs: joined }) => !cancelled && setLabs(joined))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LabList
      labs={labs}
      error={error}
      empty={
        <>
          <p className="text-gray-600">You haven't been added to any labs yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            Ask a lab manager to add you by your username.
          </p>
        </>
      }
    />
  );
}

function ManagerLabs() {
  const [labs, setLabs] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  //The lab currently being deleted, so only that row's button goes quiet.
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listLabs()
      .then(({ labs: owned }) => !cancelled && setLabs(owned))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated(lab) {
    setLabs((current) => [lab, ...(current ?? [])]);
    setCreating(false);
  }

  //Deleting a lab deletes the members equipment and the reservations. 
  async function handleDelete(lab) {
    setDeletingId(lab.id);
    setDeleteError(null);

    try {
      await api.deleteLab(lab.id);
      setLabs((current) => current.filter((owned) => owned.id !== lab.id));
    } catch (err) {
      setDeleteError(err.status ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating((open) => !open)}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {creating ? 'Cancel' : 'Create lab'}
        </button>
      </div>

      {creating && <CreateLabForm onCreated={handleCreated} />}

      {deleteError && (
        <div className="mt-4">
          <FormError id="delete-lab-error" message={deleteError} />
        </div>
      )}

      <LabList
        labs={labs}
        error={error}
        onDelete={handleDelete}
        deletingId={deletingId}
        empty={
          <>
            <p className="text-gray-600">You don't own any labs yet.</p>
            <p className="mt-1 text-sm text-gray-500">Use Create lab to make your first one.</p>
          </>
        }
      />
    </>
  );
}

function CreateLabForm({ onCreated }) {
  const [status, setStatus] = useState(STATES.IDLE);
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(STATES.SUBMITTING);
    setErrorMessage(null);

    try {
      const { lab } = await api.createLab(name);
      onCreated(lab);
    } catch (error) {
      setErrorMessage(error.status ? error.message : 'Something went wrong. Please try again.');
      setStatus(STATES.IDLE);
    }
  }

  const errorId = errorMessage ? ERROR_ID : undefined;

  return (
    <form
      className="mt-4 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      onSubmit={handleSubmit}
      noValidate
    >
      <FormField
        id="lab-name"
        label="Lab name"
        hint="At most 30 characters."
        value={name}
        onChange={(e) => setName(e.target.value)}
        errorId={errorId}
        autoFocus
        required
      />

      <FormError id={ERROR_ID} message={errorMessage} />

      <SubmitButton busy={status === STATES.SUBMITTING} busyLabel="Creating lab…">
        Create Lab
      </SubmitButton>
    </form>
  );
}

//Shared by both roles. But the delete button for labs only appears for a lab manager. 
function LabList({ labs, error, onDelete, deletingId, empty }) {
  if (error) {
    return <FormError id="labs-error" message={error} />;
  }

  if (labs === null) {
    return <p className="mt-6 text-gray-500">Loading…</p>;
  }

  if (labs.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        {empty}
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-2">
      {labs.map((lab) => (
        <li
          key={lab.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
        >
          <Link
            to={`/labs/${lab.id}`}
            className="font-medium text-gray-900 hover:text-indigo-700 hover:underline"
          >
            {lab.name}
          </Link>
          <span className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              Created {new Date(lab.createdAt).toLocaleDateString()}
            </span>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(lab)}
                disabled={deletingId === lab.id}
                aria-label={`Delete ${lab.name}`}
                className="rounded px-2 py-0.5 text-lg leading-none text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-40"
              >
                ×
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
