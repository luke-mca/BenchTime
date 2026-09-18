import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/userRepository.js';
import { TokenService } from './tokenService.js';
import { assertNonEmpty, assertOneOf } from '../utils/validation.js';
import {
  ValidationError,
  UsernameTakenError,
  WeakPasswordError,
  InvalidCredentialsError,
  UnauthorizedError,
} from '../errors.js';

export const ROLES = ['member', 'manager'];

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;
//bcrypt ignores everything past 72 bytes, so longer passwords are rejected instead of silently truncated.
const MAX_PASSWORD_BYTES = 72;
const BCRYPT_ROUNDS = 10;

//Postgres error code for a unique constraint violation.
const UNIQUE_VIOLATION = '23505';

//Compared against when the username doesn't exist so a failed login takes about
//the same time either way. Created on first use so importing this file stays fast.
let dummyHashPromise;
function getDummyHash() {
  dummyHashPromise ??= bcrypt.hash('benchtime-dummy-password', BCRYPT_ROUNDS);
  return dummyHashPromise;
}

//The only shape of a user that leaves this service. Never includes password_hash.
export function toPublicUser(row) {
  return { id: String(row.id), username: row.username, role: row.role };
}

export const AuthService = {
  async register({ username, password, role } = {}) {
    //1. Required fields and allowed role.
    assertNonEmpty(username, 'Username', 'MISSING_USERNAME');
    assertNonEmpty(password, 'Password', 'MISSING_PASSWORD');
    assertOneOf(role, ROLES, 'Role', 'INVALID_ROLE');

    //2. Username format.
    const cleanUsername = username.trim();
    if (!USERNAME_PATTERN.test(cleanUsername)) {
      throw new ValidationError(
        'Username must be 3-32 characters using only letters, numbers, underscores, periods, or hyphens.',
        'INVALID_USERNAME',
      );
    }

    //3. Password strength. Checked before the database so bad input costs nothing.
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new WeakPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
      throw new WeakPasswordError(`Password must be at most ${MAX_PASSWORD_BYTES} bytes.`);
    }

    //4. Username must be unused (case-insensitive).
    if (await UserRepository.findByUsername(cleanUsername)) {
      throw new UsernameTakenError();
    }

    //5. Hash only after the cheap checks pass.
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    //6. The unique index is the final guard: two requests can both pass step 4
    //before either one inserts. Only that specific error means "taken".
    let row;
    try {
      row = await UserRepository.create({ username: cleanUsername, passwordHash, role });
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) throw new UsernameTakenError();
      throw error;
    }

    const user = toPublicUser(row);
    return { user, ...TokenService.issueTokens(user) };
  },

  async login({ username, password } = {}) {
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new InvalidCredentialsError();
    }

    const row = await UserRepository.findByUsername(username.trim());
    if (!row) {
      await bcrypt.compare(password, await getDummyHash());
      throw new InvalidCredentialsError();
    }

    const matches = await bcrypt.compare(password, row.password_hash);
    if (!matches) {
      throw new InvalidCredentialsError();
    }

    const user = toPublicUser(row);
    return { user, ...TokenService.issueTokens(user) };
  },

  //Issues new tokens from a valid refresh token. The user is loaded again so a
  //deleted account can't keep refreshing, and the role is always current.
  async refresh(refreshToken) {
    let payload;
    try {
      payload = TokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Your session has expired. Please log in again.');
    }

    const row = await UserRepository.findById(payload.sub);
    if (!row) {
      throw new UnauthorizedError('Your session has expired. Please log in again.');
    }

    const user = toPublicUser(row);
    return { user, ...TokenService.issueTokens(user) };
  },

  async getCurrentUser(id) {
    const row = await UserRepository.findById(id);
    if (!row) throw new UnauthorizedError();
    return toPublicUser(row);
  },
};
