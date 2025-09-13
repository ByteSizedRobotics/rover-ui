// tests/utils/api.ts
import request from 'supertest';
import { handler } from '../../build/handler.js';
import type { RequestListener } from 'http';

export const api = () => request(handler as unknown as RequestListener);
