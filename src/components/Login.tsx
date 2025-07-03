import React, { useState } from 'react';

interface LoginProps {
    onLogin: (
        password: string
    ) => Promise<{ success: boolean; error?: string }>;
    isLoading?: boolean;
}

export const Login: React.FC<LoginProps> = ({ onLogin, isLoading = false }) => {
    const [password, setPassword] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();

        if (!password.trim()) {
            setError('Password is required');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const result = await onLogin(password);
            if (!result.success) {
                setError(result.error || 'Login failed');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePasswordChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ): void => {
        setPassword(e.target.value);
        if (error) {
            setError(''); // Clear error when user starts typing
        }
    };

    if (isLoading) {
        return (
            <div className="login-overlay">
                <div className="login-modal">
                    <div className="login-header">
                        <h2>Loading...</h2>
                        <p>Checking authentication status</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-overlay">
            <div className="login-modal">
                <div className="login-header">
                    <h2>SSH Terminal Access</h2>
                    <p>Enter your password to continue</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={handlePasswordChange}
                            placeholder="Enter your password"
                            disabled={isSubmitting}
                            autoFocus
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSubmitting || !password.trim()}
                    >
                        {isSubmitting ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};
