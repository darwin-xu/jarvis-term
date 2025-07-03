import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

interface UseAuthReturn {
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const checkAuth = async (): Promise<void> => {
        try {
            const authenticated = await authService.checkAuth();
            setIsAuthenticated(authenticated);
        } catch (error) {
            console.error('Auth check failed:', error);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (
        password: string
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await authService.login(password);
            if (response.ok) {
                setIsAuthenticated(true);
                return { success: true };
            } else {
                return { success: false, error: 'Invalid password' };
            }
        } catch (error) {
            console.error('Login failed:', error);
            return { success: false, error: 'Login failed. Please try again.' };
        }
    };

    const logout = async (): Promise<void> => {
        try {
            await authService.logout();
            setIsAuthenticated(false);
        } catch (error) {
            console.error('Logout failed:', error);
            // Still set to false even if logout request fails
            setIsAuthenticated(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    return {
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkAuth,
    };
};
