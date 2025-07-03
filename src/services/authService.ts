import { AuthResponse } from '../types';

class AuthService {
    /**
     * Authenticate user with password
     */
    async login(password: string): Promise<AuthResponse> {
        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Login error:', error);
            return { ok: false };
        }
    }

    /**
     * Logout current user
     */
    async logout(): Promise<AuthResponse> {
        try {
            const response = await fetch('/auth/logout', {
                method: 'POST',
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Logout error:', error);
            return { ok: false };
        }
    }

    /**
     * Check if user is authenticated
     */
    async checkAuth(): Promise<boolean> {
        try {
            const response = await fetch('/auth/check');
            const data = await response.json();
            return data.authenticated === true;
        } catch (error) {
            console.error('Auth check error:', error);
            return false;
        }
    }
}

export const authService = new AuthService();
