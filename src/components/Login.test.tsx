import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test/utils';
import { Login } from './Login';

describe('Login Component', () => {
    const mockOnLogin = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders login form correctly', () => {
        render(<Login onLogin={mockOnLogin} />);

        expect(screen.getByText('SSH Terminal Access')).toBeInTheDocument();
        expect(
            screen.getByText('Enter your password to continue')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Login' })
        ).toBeInTheDocument();
    });

    it('shows loading state when isLoading is true', () => {
        render(<Login onLogin={mockOnLogin} isLoading={true} />);

        expect(screen.getByText('Loading...')).toBeInTheDocument();
        expect(
            screen.getByText('Checking authentication status')
        ).toBeInTheDocument();
    });

    it('disables login button when password is empty', () => {
        render(<Login onLogin={mockOnLogin} />);

        const loginButton = screen.getByRole('button', { name: 'Login' });
        expect(loginButton).toBeDisabled();
    });

    it('enables login button when password is entered', async () => {
        render(<Login onLogin={mockOnLogin} />);

        const passwordInput = screen.getByLabelText('Password');
        const loginButton = screen.getByRole('button', { name: 'Login' });

        fireEvent.change(passwordInput, { target: { value: 'test-password' } });

        await waitFor(() => {
            expect(loginButton).not.toBeDisabled();
        });
    });

    it('calls onLogin when form is submitted with valid password', async () => {
        mockOnLogin.mockResolvedValue({ success: true });

        render(<Login onLogin={mockOnLogin} />);

        const passwordInput = screen.getByLabelText('Password');
        const loginButton = screen.getByRole('button', { name: 'Login' });

        fireEvent.change(passwordInput, { target: { value: 'test-password' } });
        fireEvent.click(loginButton);

        await waitFor(() => {
            expect(mockOnLogin).toHaveBeenCalledWith('test-password');
        });
    });

    it('shows error message when login fails', async () => {
        mockOnLogin.mockResolvedValue({
            success: false,
            error: 'Invalid password',
        });

        render(<Login onLogin={mockOnLogin} />);

        const passwordInput = screen.getByLabelText('Password');
        const loginButton = screen.getByRole('button', { name: 'Login' });

        fireEvent.change(passwordInput, {
            target: { value: 'wrong-password' },
        });
        fireEvent.click(loginButton);

        await waitFor(() => {
            expect(screen.getByText('Invalid password')).toBeInTheDocument();
        });
    });

    it('shows loading state during login submission', async () => {
        const slowLogin = vi
            .fn()
            .mockImplementation(
                () =>
                    new Promise(resolve =>
                        setTimeout(() => resolve({ success: true }), 100)
                    )
            );

        render(<Login onLogin={slowLogin} />);

        const passwordInput = screen.getByLabelText('Password');
        const loginButton = screen.getByRole('button', { name: 'Login' });

        fireEvent.change(passwordInput, { target: { value: 'test-password' } });
        fireEvent.click(loginButton);

        expect(screen.getByText('Logging in...')).toBeInTheDocument();
        expect(loginButton).toBeDisabled();

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Login' })
            ).toBeInTheDocument();
        });
    });

    it('clears error when user starts typing', async () => {
        mockOnLogin.mockResolvedValue({
            success: false,
            error: 'Invalid password',
        });

        render(<Login onLogin={mockOnLogin} />);

        const passwordInput = screen.getByLabelText('Password');
        const loginButton = screen.getByRole('button', { name: 'Login' });

        // First, trigger an error
        fireEvent.change(passwordInput, {
            target: { value: 'wrong-password' },
        });
        fireEvent.click(loginButton);

        await waitFor(() => {
            expect(screen.getByText('Invalid password')).toBeInTheDocument();
        });

        // Then start typing again
        fireEvent.change(passwordInput, { target: { value: 'new-password' } });

        expect(screen.queryByText('Invalid password')).not.toBeInTheDocument();
    });

    it('handles Enter key submission', async () => {
        mockOnLogin.mockResolvedValue({ success: true });

        render(<Login onLogin={mockOnLogin} />);

        const passwordInput = screen.getByLabelText('Password');
        const submitButton = screen.getByRole('button', { name: /login/i });

        fireEvent.change(passwordInput, { target: { value: 'test-password' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockOnLogin).toHaveBeenCalledWith('test-password');
        });
    });
});
