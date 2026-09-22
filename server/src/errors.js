//Application errors. Each one carries the HTTP status and error code the API returns,
//so routes don't need a chain of instanceof checks to translate them.
export class AppError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message, 400, code);
  }
}

export class UsernameTakenError extends AppError {
  constructor() {
    super('That username is already taken.', 409, 'USERNAME_TAKEN');
  }
}

export class WeakPasswordError extends AppError {
  constructor(message) {
    super(message, 400, 'WEAK_PASSWORD');
  }
}

//Used for both an unknown username and a wrong password so a failed login
//doesn't reveal which usernames exist.
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'You need to be signed in to do that.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do that.') {
    super(message, 403, 'FORBIDDEN');
  }
}

//Used when something belongs to someone else(like a lab belonging to another manager) 
//but that information should not be shown to the client. 
export class NotFoundError extends AppError {
  constructor(message = 'That does not exist.') {
    super(message, 404, 'NOT_FOUND');
  }
}

//For a valid request that conflicts with something like trying to add a member that was already 
//added to a lab. 
export class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') {
    super(message, 409, code);
  }
}
