export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: Record<string, string>[];

  constructor(
    statusCode: number,
    message: string,
    errors?: Record<string, string>[],
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "❌ Bad request.", errors?: Record<string, string>[]) {
    super(400, message, errors);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "🔒 Authentication required.") {
    super(401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "🚫 Access denied.") {
    super(403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "🔍 Resource not found.") {
    super(404, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "⚠️ Resource already exists.") {
    super(409, message);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = "🚫 Too many requests. Please slow down.") {
    super(429, message);
  }
}

export class InternalError extends ApiError {
  constructor(message = "💥 Internal server error.") {
    super(500, message, undefined, false);
  }
}
