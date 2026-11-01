import express from 'express';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { labsRouter } from './routes/labs.js';
import { AppError } from './errors.js';

//Setting up endpoint rate limitng. 

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const defaultRateLimits = {
  api: { windowMs: FIFTEEN_MINUTES, limit: 300 },
  auth: { windowMs: FIFTEEN_MINUTES, limit: 10 },
};

function createLimiter({ windowMs, limit }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } });
    },
  });
}

//Builds the Express app. Keeping it separate from server.js for testing.
export function createApp({ rateLimits = defaultRateLimits } = {}) {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use('/api', createLimiter(rateLimits.api));
  app.use('/api/auth', createLimiter(rateLimits.auth));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/labs', labsRouter);

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint.' } });
  });

  app.use(errorHandler);

  return app;
}

//Turns every error into { error: { code, message } }. Unexpected errors are logged
//but never sent to the client db details stay on the server. 
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  //Malformed JSON bodies from express.json().
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON.' } });
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our end.' } });
}
