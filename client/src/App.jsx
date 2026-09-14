import { useEffect, useState } from 'react';
import { api } from './lib/api.js';

//Placeholder that just pings the health endpoint to make sure the server is running. 
export default function App() {
  const [status, setStatus] = useState({ state: 'loading', message: 'Checking API...' });

  useEffect(() => {
    api
      .health()
      //See index.css for the different states. 
      .then((body) => setStatus({ state: 'ok', message: `API: ${body.status} (${body.service})` }))
      .catch((error) => setStatus({ state: 'error', message: `API unreachable - ${error.message}` }));
  }, []);

  return (
    <main>
      <h1>BenchTime</h1>
      <p className="subtitle">Lab equipment reservation system</p>
      <p className={`status ${status.state}`}>{status.message}</p>
    </main>
  );
}
