import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, AUTH_STATUS, useAuth } from './lib/AuthContext.jsx';
import { NavBar } from './components/NavBar.jsx';
import { Landing } from './components/Landing.jsx';
import { Home } from './components/Home.jsx';
import { LoginForm } from './components/LoginForm.jsx';
import { RegisterForm } from './components/RegisterForm.jsx';
import { LabPage } from './components/LabPage.jsx';
import { RequireAuth } from './components/RequireAuth.jsx';

//Routing and layout only. No business logic here.
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavBar />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <Routes>
            <Route path="/" element={<IndexPage />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route
              path="/labs/:labId"
              element={
                <RequireAuth role="manager">
                  <LabPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

//"/" is the landing page for visitors and the home page once signed in.
function IndexPage() {
  const { status } = useAuth();

  if (status === AUTH_STATUS.LOADING) {
    return <p className="text-gray-500">Loading…</p>;
  }
  return status === AUTH_STATUS.SIGNED_IN ? <Home /> : <Landing />;
}

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-indigo-600 underline">
        Back to BenchTime
      </Link>
    </div>
  );
}
