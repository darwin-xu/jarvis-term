const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Create a test app with minimal setup
function createTestApp() {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());

    // Mock session storage
    const sessions = new Map();

    // Authentication middleware for testing
    const requireAuth = (req, res, next) => {
        if (req.cookies.auth !== '1') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    };

    // Test routes
    app.post('/auth/login', (req, res) => {
        const { password } = req.body;
        const expectedPassword = process.env.APP_PASSWORD || 'test-password'; // fallback for testing

        if (!password) {
            return res.status(401).json({ ok: false });
        }

        if (password === expectedPassword) {
            res.cookie('auth', '1', { httpOnly: true });
            res.json({ ok: true });
        } else {
            res.status(401).json({ ok: false });
        }
    });

    app.post('/auth/logout', (req, res) => {
        res.clearCookie('auth');
        res.json({ ok: true });
    });

    app.get('/auth/check', (req, res) => {
        res.json({ authenticated: req.cookies.auth === '1' });
    });

    app.post('/sessions/terminate', requireAuth, (req, res) => {
        const { sessionId } = req.body || {};
        if (sessions.has(sessionId)) {
            sessions.delete(sessionId);
            res.json({ ok: true });
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    });

    app.post('/api/command-log', requireAuth, (req, res) => {
        const { command, output, timestamp, executionTime, sessionId } =
            req.body;

        if (!command || command.trim() === '') {
            return res.status(400).json({ error: 'Command is required' });
        }

        // Mock successful logging
        res.json({ ok: true });
    });

    return app;
}

module.exports = { createTestApp };
