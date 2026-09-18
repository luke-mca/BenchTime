import { useAuth } from '../lib/AuthContext.jsx';

//What signed-in users see at "/". Placeholders until the labs feature (US-2, US-7) lands.
export function Home() {
  const { user } = useAuth();

  return (
    <section>
      <h1 className="text-2xl font-semibold">Your labs</h1>
      {user.role === 'manager' ? <ManagerLabs /> : <MemberLabs />}
    </section>
  );
}

function MemberLabs() {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <p className="text-gray-600">You haven't been added to any labs yet.</p>
      <p className="mt-1 text-sm text-gray-500">Ask a lab manager to add you by your username.</p>
    </div>
  );
}

function ManagerLabs() {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <p className="text-gray-600">You don't own any labs yet.</p>
      {/* TODO(US-7): replace with a "Create lab" button that opens the create-lab form. */}
      <p className="mt-1 text-sm text-gray-500">Creating a lab is coming soon.</p>
    </div>
  );
}
