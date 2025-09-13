import { describe, it, expect } from 'vitest';

describe('Environment', () => {
  it('should load DATABASE_URL from .env.test', () => {
    expect(process.env.DATABASE_URL).toBe('postgres://root:mysecretpassword@localhost:5433/test');
  });
});