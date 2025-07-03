const request = require('supertest');
const { createTestApp } = require('./testApp');

describe('Authentication Routes', () => {
    let app;

    beforeEach(() => {
        app = createTestApp();
    });

    describe('POST /auth/login', () => {
        it('should login successfully with correct password', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({ password: 'test-password' })
                .expect(200);

            expect(response.body).toEqual({ ok: true });
            expect(response.headers['set-cookie']).toBeDefined();
            expect(response.headers['set-cookie'][0]).toContain('auth=1');
        });

        it('should reject incorrect password', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({ password: 'wrong-password' })
                .expect(401);

            expect(response.body).toEqual({ ok: false });
        });

        it('should reject empty password', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({ password: '' })
                .expect(401);

            expect(response.body).toEqual({ ok: false });
        });

        it('should reject missing password field', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({})
                .expect(401);

            expect(response.body).toEqual({ ok: false });
        });
    });

    describe('POST /auth/logout', () => {
        it('should logout successfully', async () => {
            const response = await request(app)
                .post('/auth/logout')
                .expect(200);

            expect(response.body).toEqual({ ok: true });
            expect(response.headers['set-cookie']).toBeDefined();
            expect(response.headers['set-cookie'][0]).toContain('auth=;');
        });

        it('should logout successfully even without being logged in', async () => {
            const response = await request(app)
                .post('/auth/logout')
                .expect(200);

            expect(response.body).toEqual({ ok: true });
        });
    });

    describe('GET /auth/check', () => {
        it('should return authenticated: true when logged in', async () => {
            // First login
            const loginAgent = request.agent(app);
            await loginAgent
                .post('/auth/login')
                .send({ password: 'test-password' })
                .expect(200);

            // Then check auth status
            const response = await loginAgent.get('/auth/check').expect(200);

            expect(response.body).toEqual({ authenticated: true });
        });

        it('should return authenticated: false when not logged in', async () => {
            const response = await request(app).get('/auth/check').expect(200);

            expect(response.body).toEqual({ authenticated: false });
        });

        it('should return authenticated: false after logout', async () => {
            // First login
            const loginAgent = request.agent(app);
            await loginAgent
                .post('/auth/login')
                .send({ password: 'test-password' })
                .expect(200);

            // Logout
            await loginAgent.post('/auth/logout').expect(200);

            // Check auth status
            const response = await loginAgent.get('/auth/check').expect(200);

            expect(response.body).toEqual({ authenticated: false });
        });
    });
});
