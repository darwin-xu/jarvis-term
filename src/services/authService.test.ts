import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './authService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AuthService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('login', () => {
        it('sends login request with correct data', async () => {
            mockFetch.mockResolvedValue({
                json: vi.fn().mockResolvedValue({ ok: true }),
            });

            const result = await authService.login('test-password');

            expect(mockFetch).toHaveBeenCalledWith('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: 'test-password' }),
            });
            expect(result).toEqual({ ok: true });
        });

        it('handles successful login response', async () => {
            mockFetch.mockResolvedValue({
                json: vi.fn().mockResolvedValue({ ok: true }),
            });

            const result = await authService.login('correct-password');

            expect(result.ok).toBe(true);
        });

        it('handles failed login response', async () => {
            mockFetch.mockResolvedValue({
                json: vi.fn().mockResolvedValue({ ok: false }),
            });

            const result = await authService.login('wrong-password');

            expect(result.ok).toBe(false);
        });

        it('handles network errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await authService.login('test-password');

            expect(result.ok).toBe(false);
        });

        it('handles JSON parsing errors', async () => {
            mockFetch.mockResolvedValue({
                json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
            });

            const result = await authService.login('test-password');

            expect(result.ok).toBe(false);
        });
    });

    describe('logout', () => {
        it('sends logout request', async () => {
            mockFetch.mockResolvedValue({
                json: vi.fn().mockResolvedValue({ ok: true }),
            });

            const result = await authService.logout();

            expect(mockFetch).toHaveBeenCalledWith('/auth/logout', {
                method: 'POST',
            });
            expect(result).toEqual({ ok: true });
        });

        it('handles logout errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await authService.logout();

            expect(result.ok).toBe(false);
        });
    });

    describe('checkAuth', () => {
        it('returns true for authenticated user', async () => {
            mockFetch.mockResolvedValue({
                json: vi.fn().mockResolvedValue({ authenticated: true }),
            });

            const result = await authService.checkAuth();

            expect(mockFetch).toHaveBeenCalledWith('/auth/check');
            expect(result).toBe(true);
        });

        it('returns false for unauthenticated user', async () => {
            mockFetch.mockResolvedValue({
                json: vi.fn().mockResolvedValue({ authenticated: false }),
            });

            const result = await authService.checkAuth();

            expect(result).toBe(false);
        });

        it('returns false for missing authenticated field', async () => {
            mockFetch.mockResolvedValue({
                json: vi.fn().mockResolvedValue({}),
            });

            const result = await authService.checkAuth();

            expect(result).toBe(false);
        });

        it('handles network errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await authService.checkAuth();

            expect(result).toBe(false);
        });

        it('handles JSON parsing errors', async () => {
            mockFetch.mockResolvedValue({
                json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
            });

            const result = await authService.checkAuth();

            expect(result).toBe(false);
        });
    });
});
