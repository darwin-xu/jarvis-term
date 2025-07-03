import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from './useAuth';
import { authService } from '../services/authService';

// Mock the auth service
vi.mock('../services/authService', () => ({
    authService: {
        login: vi.fn(),
        logout: vi.fn(),
        checkAuth: vi.fn(),
    },
}));

describe('useAuth Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes with default state', () => {
        vi.mocked(authService.checkAuth).mockResolvedValue(false);

        const { result } = renderHook(() => useAuth());

        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.isLoading).toBe(true);
    });

    it('checks authentication on mount', async () => {
        vi.mocked(authService.checkAuth).mockResolvedValue(true);

        const { result } = renderHook(() => useAuth());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isAuthenticated).toBe(true);
        expect(authService.checkAuth).toHaveBeenCalledTimes(1);
    });

    it('handles successful login', async () => {
        vi.mocked(authService.checkAuth).mockResolvedValue(false);
        vi.mocked(authService.login).mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useAuth());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const loginResult = await result.current.login('test-password');

        expect(loginResult.success).toBe(true);

        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(true);
        });

        expect(authService.login).toHaveBeenCalledWith('test-password');
    });

    it('handles failed login', async () => {
        vi.mocked(authService.checkAuth).mockResolvedValue(false);
        vi.mocked(authService.login).mockResolvedValue({ ok: false });

        const { result } = renderHook(() => useAuth());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const loginResult = await result.current.login('wrong-password');

        expect(loginResult.success).toBe(false);
        expect(loginResult.error).toBe('Invalid password');
        expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles login error', async () => {
        vi.mocked(authService.checkAuth).mockResolvedValue(false);
        vi.mocked(authService.login).mockRejectedValue(
            new Error('Network error')
        );

        const { result } = renderHook(() => useAuth());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const loginResult = await result.current.login('test-password');

        expect(loginResult.success).toBe(false);
        expect(loginResult.error).toBe('Login failed. Please try again.');
        expect(result.current.isAuthenticated).toBe(false);
    });

    it('handles successful logout', async () => {
        vi.mocked(authService.checkAuth).mockResolvedValue(true);
        vi.mocked(authService.logout).mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useAuth());

        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(true);
        });

        await result.current.logout();

        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(false);
        });

        expect(authService.logout).toHaveBeenCalledTimes(1);
    });

    it('handles logout error gracefully', async () => {
        vi.mocked(authService.checkAuth).mockResolvedValue(true);
        vi.mocked(authService.logout).mockRejectedValue(
            new Error('Network error')
        );

        const { result } = renderHook(() => useAuth());

        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(true);
        });

        await result.current.logout();

        // Should still set authenticated to false even if logout fails
        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(false);
        });
    });

    it('handles auth check error', async () => {
        vi.mocked(authService.checkAuth).mockRejectedValue(
            new Error('Network error')
        );

        const { result } = renderHook(() => useAuth());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isAuthenticated).toBe(false);
    });

    it('can manually re-check authentication', async () => {
        vi.mocked(authService.checkAuth)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        const { result } = renderHook(() => useAuth());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isAuthenticated).toBe(false);

        await result.current.checkAuth();

        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(true);
        });

        expect(authService.checkAuth).toHaveBeenCalledTimes(2);
    });
});
