import pg from 'pg';
import { config } from '../config.js';

//File connecting to and managing the database. 


//Using one pool here so that there is only once connection to the database.  

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('Unexpected error on an idle database client:', error);
});
