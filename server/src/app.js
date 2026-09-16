import express from 'express';
import { healthRouter } from './routes/health.js';
import { labsRouter } from './routes/labs.js';
import { meRouter } from './routes/me.js';

//Builds the Express app. Keeping it separate from server.js for testing. 
export function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api/health', healthRouter);
  app.use('/api/labs', labsRouter);
  app.use('/api/me', meRouter);

  return app;
}
