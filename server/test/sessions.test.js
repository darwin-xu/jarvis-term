const request = require('supertest');
const { createTestApp } = require('./testApp');

describe('Session Management Routes', () => {
    let app;
    let authenticatedAgent;

    beforeEach(async () => {
        app = createTestApp();

        // Create an authenticated agent
        authenticatedAgent = request.agent(app);
        await authenticatedAgent
            .post('/auth/login')
            .send({ password: 'test-password' })
            .expect(200);
    });

    describe('POST /sessions/terminate', () => {
        it('should require authentication', async () => {
            const response = await request(app)
                .post('/sessions/terminate')
                .send({ sessionId: 'test-session' })
                .expect(401);

            expect(response.body).toEqual({ error: 'Unauthorized' });
        });

        it('should return 404 for non-existent session', async () => {
            const response = await authenticatedAgent
                .post('/sessions/terminate')
                .send({ sessionId: 'non-existent-session' })
                .expect(404);

            expect(response.body).toEqual({ error: 'Session not found' });
        });

        it('should handle missing sessionId', async () => {
            const response = await authenticatedAgent
                .post('/sessions/terminate')
                .send({})
                .expect(404);

            expect(response.body).toEqual({ error: 'Session not found' });
        });

        it('should handle null sessionId', async () => {
            const response = await authenticatedAgent
                .post('/sessions/terminate')
                .send({ sessionId: null })
                .expect(404);

            expect(response.body).toEqual({ error: 'Session not found' });
        });
    });
});
