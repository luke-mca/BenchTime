import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { FormError, FormField, SubmitButton } from './FormField.jsx';

const STATES = { IDLE: 'idle', SUBMITTING: 'submitting' };
const ERROR_ID = 'add-member-error';
const EQUIPMENT_ERROR_ID = 'add-equipment-error';

export function LabPage() {
  const { labId } = useParams();
  const { user } = useAuth();
  const [lab, setLab] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    //Clearing this so that switching labs never shows the previous one while the new one loads.
    setLab(null);
    setError('');

    api
      .getLab(labId)
      .then(({ lab: found }) => !cancelled && setLab(found))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [labId]);

  if (error) {
    return (
      <section>
        <BackLink />
        <div className="mt-6">
          <FormError id="lab-error" message={error} />
        </div>
      </section>
    );
  }

  if (!lab) {
    return (
      <section>
        <BackLink />
        <p className="mt-6 text-gray-500">Loading…</p>
      </section>
    );
  }

  return (
    <section>
      <BackLink />

      <h1 className="mt-4 text-2xl font-semibold">{lab.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        Managed by <span className="font-medium text-gray-700">{lab.ownerUsername}</span>
        {user.role === 'manager' && ' (you)'} · Created{' '}
        {new Date(lab.createdAt).toLocaleDateString()}
      </p>

      <LabEquipment labId={labId} canAdd={user.role === 'manager'} />

      {user.role === 'manager' && <LabMembers labId={labId} />}
    </section>
  );
}

//The equipment list, seen by the manager and the lab's members. Only the manager gets the Add equipment button.
function LabEquipment({ labId, canAdd }) {
  const [equipment, setEquipment] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  //The equipment currently being removed, so only that row's button goes quiet.
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setEquipment(null);
    setError('');

    api
      .listEquipment(labId)
      .then(({ equipment: current }) => !cancelled && setEquipment(current))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [labId]);

  //Kept sorted by name so the list matches the order the server returns.
  function handleAdded(item) {
    setEquipment((current) =>
      [...(current ?? []), item].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    );
    setAdding(false);
  }

  //Removal is a soft delete on the server so past reservations are kept, but it disappears from the list.
  async function handleRemove(item) {
    if (!window.confirm(`Remove ${item.name} from this lab?`)) return;

    setRemovingId(item.id);
    setRemoveError(null);

    try {
      await api.removeEquipment(labId, item.id);
      setEquipment((current) => current.filter((existing) => existing.id !== item.id));
    } catch (err) {
      setRemoveError(err.status ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Equipment</h2>
        {canAdd && (
          <button
            type="button"
            onClick={() => setAdding((open) => !open)}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {adding ? 'Cancel' : 'Add equipment'}
          </button>
        )}
      </div>

      {adding && <AddEquipmentForm labId={labId} onAdded={handleAdded} />}

      {removeError && (
        <div className="mt-4">
          <FormError id="remove-equipment-error" message={removeError} />
        </div>
      )}

      <EquipmentList
        equipment={equipment}
        error={error}
        canAdd={canAdd}
        onRemove={canAdd ? handleRemove : null}
        removingId={removingId}
      />
    </>
  );
}

function AddEquipmentForm({ labId, onAdded }) {
  const [status, setStatus] = useState(STATES.IDLE);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(STATES.SUBMITTING);
    setErrorMessage(null);

    try {
      const { equipment } = await api.addEquipment(labId, { name, description });
      onAdded(equipment);
    } catch (error) {
      setErrorMessage(error.status ? error.message : 'Something went wrong. Please try again.');
      setStatus(STATES.IDLE);
    }
  }

  const errorId = errorMessage ? EQUIPMENT_ERROR_ID : undefined;

  return (
    <form
      className="mt-4 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      onSubmit={handleSubmit}
      noValidate
    >
      <FormField
        id="equipment-name"
        label="Equipment name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        errorId={errorId}
        maxLength={50}
        autoFocus
        required
      />

      <div>
        <label htmlFor="equipment-description" className="block text-sm font-medium text-gray-700">
          Description <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="equipment-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <FormError id={EQUIPMENT_ERROR_ID} message={errorMessage} />

      <SubmitButton busy={status === STATES.SUBMITTING} busyLabel="Adding equipment…">
        Add Equipment
      </SubmitButton>
    </form>
  );
}

function EquipmentList({ equipment, error, canAdd, onRemove, removingId }) {
  if (error) {
    return (
      <div className="mt-4">
        <FormError id="equipment-error" message={error} />
      </div>
    );
  }

  if (equipment === null) {
    return <p className="mt-4 text-gray-500">Loading…</p>;
  }

  if (equipment.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="text-gray-600">This lab doesn't have any equipment yet.</p>
        {canAdd && (
          <p className="mt-1 text-sm text-gray-500">Use Add equipment to add the first one.</p>
        )}
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-2">
      {equipment.map((item) => (
        <li
          key={item.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
        >
          <div>
            <p className="font-medium text-gray-900">{item.name}</p>
            {item.description && (
              <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{item.description}</p>
            )}
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              disabled={removingId === item.id}
              aria-label={`Remove ${item.name}`}
              className="rounded px-2 py-0.5 text-lg leading-none text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-40"
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

//The member list plus the Add member button which was created similar to adding a lab in the manager's home menu. 
function LabMembers({ labId }) {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  //The member currently being removed, so only that row's button goes quiet.
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setMembers(null);
    setError('');

    api
      .listMembers(labId)
      .then(({ members: current }) => !cancelled && setMembers(current))
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [labId]);

  //Kept sorted by username so the list matches the order the server returns.
  function handleAdded(member) {
    setMembers((current) =>
      [...(current ?? []), member].sort((a, b) => a.username.localeCompare(b.username)),
    );
    setAdding(false);
  }

  //Removing a member should only take away their access to this lab/equipment chart. 
  async function handleRemove(member) {
    setRemovingId(member.id);
    setRemoveError(null);

    try {
      await api.removeMember(labId, member.id);
      setMembers((current) => current.filter((added) => added.id !== member.id));
    } catch (err) {
      setRemoveError(err.status ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Members</h2>
        <button
          type="button"
          onClick={() => setAdding((open) => !open)}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {adding ? 'Cancel' : 'Add member'}
        </button>
      </div>

      {adding && <AddMemberForm labId={labId} onAdded={handleAdded} />}

      {removeError && (
        <div className="mt-4">
          <FormError id="remove-member-error" message={removeError} />
        </div>
      )}

      <MemberList
        members={members}
        error={error}
        onRemove={handleRemove}
        removingId={removingId}
      />
    </>
  );
}

function AddMemberForm({ labId, onAdded }) {
  const [status, setStatus] = useState(STATES.IDLE);
  const [username, setUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(STATES.SUBMITTING);
    setErrorMessage(null);

    try {
      const { member } = await api.addMember(labId, username);
      onAdded(member);
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
        id="member-username"
        label="Member username"
        hint="The username the member signed up with."
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        errorId={errorId}
        autoFocus
        required
      />

      <FormError id={ERROR_ID} message={errorMessage} />

      <SubmitButton busy={status === STATES.SUBMITTING} busyLabel="Adding member…">
        Add Member
      </SubmitButton>
    </form>
  );
}

function MemberList({ members, error, onRemove, removingId }) {
  if (error) {
    return (
      <div className="mt-4">
        <FormError id="members-error" message={error} />
      </div>
    );
  }

  if (members === null) {
    return <p className="mt-4 text-gray-500">Loading…</p>;
  }

  if (members.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="text-gray-600">This lab doesn't have any members yet.</p>
        <p className="mt-1 text-sm text-gray-500">Use Add member to add one by their username.</p>
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-2">
      {members.map((member) => (
        <li
          key={member.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
        >
          <span className="font-medium text-gray-900">{member.username}</span>
          <span className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              Added {new Date(member.addedAt).toLocaleDateString()}
            </span>
            <button
              type="button"
              onClick={() => onRemove(member)}
              disabled={removingId === member.id}
              aria-label={`Remove ${member.username}`}
              className="rounded px-2 py-0.5 text-lg leading-none text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-40"
            >
              ×
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function BackLink() {
  return (
    <Link to="/" className="text-sm font-medium text-indigo-600 underline">
      ← Back to your labs
    </Link>
  );
}
