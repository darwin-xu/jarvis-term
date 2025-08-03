import request from 'supertest';
import express from 'express';
import { MockSSHClient, MockAIService } from '../mocks';

// Mock the SSH2 module before importing the server
jest.mock('ssh2', () => ({
    Client: MockSSHClient,
}));

// Mock fetch for AI API calls
global.fetch = jest.fn();

// Set up environment before importing server
process.env.APP_PASSWORD = 'test-password';
process.env.OPENAI_API_KEY = 'test-api-key';

// Import the app after mocks are set up
import { app } from '../../src/backend/server';

describe('Server Authentication', () => {
    beforeEach(() => {
        // Clear mocks but keep environment setup
        jest.clearAllMocks();
        MockAIService.clearMockResponses();
    });

    afterEach(() => {
        jest.clearAllMocks();
        MockAIService.clearMockResponses();
    });

    describe('POST /auth/login', () => {
        it('should accept correct password', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({ password: 'test-password' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ ok: true });
            expect(response.headers['set-cookie']).toBeDefined();
        });

        it('should reject incorrect password', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({ password: 'wrong-password' });

            expect(response.status).toBe(401);
            expect(response.body).toEqual({ ok: false });
        });

        it('should handle missing password', async () => {
            const response = await request(app).post('/auth/login').send({});

            expect(response.status).toBe(401);
            expect(response.body).toEqual({ ok: false });
        });
    });

    describe('GET /auth/check', () => {
        it('should return authenticated status for valid cookie', async () => {
            const response = await request(app)
                .get('/auth/check')
                .set('Cookie', 'auth=1');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ authenticated: true });
        });

        it('should return unauthenticated status for invalid cookie', async () => {
            const response = await request(app).get('/auth/check');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ authenticated: false });
        });
    });

    describe('POST /auth/logout', () => {
        it('should clear authentication cookie', async () => {
            const response = await request(app)
                .post('/auth/logout')
                .set('Cookie', 'auth=1');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ ok: true });
            // Check that the cookie is cleared (starts with auth=; and has expiration)
            expect(response.headers['set-cookie'][0]).toMatch(
                /^auth=;.*Expires=/
            );
        });
    });
});
