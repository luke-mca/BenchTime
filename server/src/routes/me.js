import { Router } from 'express';
import { requireAuth, requireManager } from '../middleware/auth.js';

//File which contains an endpoint for verify a user. 
export const meRouter = Router();

//Returns the signed in manager. Errors come from the middleware.
//This is here so the client has a way to verify if they are actually a valid member/manager or not. 
meRouter.get('/', requireAuth, requireManager, (req, res) => {
  res.json({ user: req.user });
});
