// utils/customErrors.ts

export class VideoNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoNotFoundError';
  }
}

export class AIProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIProcessingError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}
