import { Router } from 'express';
import { pool } from '../db/pool.js';

//File with basic health endpoints. 
export const healthRouter = Router();

//For checking if the server is alive. Does not use the database. 
healthRouter.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'benchtime-api' });
});

//Queries the database to check if it is alive. 
healthRouter.get('/db', async (req, res) => {
  const result = await pool.query('SELECT NOW() AS now');
  res.json({ status: 'ok', database: 'reachable', now: result.rows[0].now });
});
