import jwt from 'jsonwebtoken';
import { config } from '../config.js';

//Creates and verifies JWTs. Tokens are stateless: nothing is stored in the database,
//so logout only clears the cookies and a copied token works until it expires.

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const TokenService = {
  issueTokens(user) {
    //Postgres bigint ids come back from pg as strings, so the subject is always a string.
    const payload = { sub: String(user.id), role: user.role };

    const accessToken = jwt.sign(payload, config.accessTokenSecret, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
    const refreshToken = jwt.sign(payload, config.refreshTokenSecret, {
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });

    return { accessToken, refreshToken };
  },

  //Both verify functions throw if the token is missing, tampered with, or expired.
  verifyAccessToken(token) {
    return jwt.verify(token, config.accessTokenSecret, { algorithms: ['HS256'] });
  },

  verifyRefreshToken(token) {
    return jwt.verify(token, config.refreshTokenSecret, { algorithms: ['HS256'] });
  },
};
