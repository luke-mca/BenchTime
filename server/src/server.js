import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';

//File for running the server. 

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`BenchTime API listening on http://localhost:${config.port} (${config.env})`);
});

//Closes the port and drains the db pool. 
async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down.`);
  server.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
