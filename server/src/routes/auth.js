import { Router } from 'express';
import { AuthService } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { REFRESH_COOKIE, setAuthCookies, clearAuthCookies } from '../utils/authCookies.js';

//Auth endpoints. Routes only translate HTTP to service calls; business rules live in AuthService.
//Express 5 forwards rejected promises to the error handler in app.js, so no try/catch is needed.
export const authRouter = Router();

//Creates the account and signs the user in.
authRouter.post('/register', async (req, res) => {
  const { username, password, role } = req.body ?? {};
  const { user, accessToken, refreshToken } = await AuthService.register({ username, password, role });
  setAuthCookies(res, { accessToken, refreshToken });
  res.status(201).json({ user });
});

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  const { user, accessToken, refreshToken } = await AuthService.login({ username, password });
  setAuthCookies(res, { accessToken, refreshToken });
  res.json({ user });
});

//Called by the client when the access token has expired.
authRouter.post('/refresh', async (req, res) => {
  try {
    const { user, accessToken, refreshToken } = await AuthService.refresh(req.cookies?.[REFRESH_COOKIE]);
    setAuthCookies(res, { accessToken, refreshToken });
    res.json({ user });
  } catch (error) {
    //A bad refresh token is useless, so drop both cookies before reporting the error.
    clearAuthCookies(res);
    throw error;
  }
});

authRouter.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await AuthService.getCurrentUser(req.user.id);
  res.json({ user });
});
