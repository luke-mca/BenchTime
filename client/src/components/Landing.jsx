import { Link } from 'react-router-dom';

//What signed-out visitors see at "/".
export function Landing() {
  return (
    <section className="py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Reserve lab equipment without the guesswork</h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
        BenchTime lets lab managers share their equipment calendar and lets members book an open time slot
        before they make the trip.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          to="/register"
          className="rounded bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Sign Up
        </Link>
        <Link
          to="/login"
          className="rounded border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Log In
        </Link>
      </div>
    </section>
  );
}
