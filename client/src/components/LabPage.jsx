import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { FormError } from './FormField.jsx';

//One lab the manager owns. Lives at /labs/:labId.
export function LabPage() {
  const { labId } = useParams();
  const [lab, setLab] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    //Cleared so switching labs never shows the previous one while the new one loads.
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
        Created {new Date(lab.createdAt).toLocaleDateString()}
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        {/* TODO(US-8, US-9): the member list and the lab's equipment go here. */}
        <p className="text-sm text-gray-500">Members and equipment are coming soon.</p>
      </div>
    </section>
  );
}

function BackLink() {
  return (
    <Link to="/" className="text-sm font-medium text-indigo-600 underline">
      ← Back to your labs
    </Link>
  );
}
