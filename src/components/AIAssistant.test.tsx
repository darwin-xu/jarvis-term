import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIAssistant } from './AIAssistant';

describe('AIAssistant Component', () => {
    const mockOnClose = vi.fn();
    const mockOnOpenConfig = vi.fn();
    const mockOnExecuteCommand = vi.fn();

    const defaultProps = {
        isOpen: true,
        onClose: mockOnClose,
        onOpenConfig: mockOnOpenConfig,
        onExecuteCommand: mockOnExecuteCommand,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders when open', () => {
        render(<AIAssistant {...defaultProps} />);

        expect(screen.getByText('AI Assistant')).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText(
                'Ask me anything or use /cmd to execute commands...'
            )
        ).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        render(<AIAssistant {...defaultProps} isOpen={false} />);

        expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument();
    });

    it('shows initial welcome message', () => {
        render(<AIAssistant {...defaultProps} />);

        expect(
            screen.getByText(/Hello! I'm your AI assistant/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/To execute terminal commands/)
        ).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        render(<AIAssistant {...defaultProps} />);

        const closeButton = screen.getByTitle('Close (Cmd+I)');
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenConfig when config button is clicked', () => {
        render(<AIAssistant {...defaultProps} />);

        const configButton = screen.getByTitle('Settings');
        fireEvent.click(configButton);

        expect(mockOnOpenConfig).toHaveBeenCalledTimes(1);
    });

    it('sends message when send button is clicked', async () => {
        render(<AIAssistant {...defaultProps} />);

        const input = screen.getByPlaceholderText(
            'Ask me anything or use /cmd to execute commands...'
        );
        const sendButton = screen.getByRole('button', { name: 'Send' });

        fireEvent.change(input, { target: { value: 'Hello AI' } });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(screen.getByText('Hello AI')).toBeInTheDocument();
        });
    });

    it('executes command when message starts with /cmd', async () => {
        mockOnExecuteCommand.mockResolvedValue(undefined);

        render(<AIAssistant {...defaultProps} />);

        const input = screen.getByPlaceholderText(
            'Ask me anything or use /cmd to execute commands...'
        );
        const sendButton = screen.getByRole('button', { name: 'Send' });

        fireEvent.change(input, { target: { value: '/cmd ls -la' } });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(mockOnExecuteCommand).toHaveBeenCalledWith('ls -la');
        });
    });

    it('executes command when message starts with /command', async () => {
        mockOnExecuteCommand.mockResolvedValue(undefined);

        render(<AIAssistant {...defaultProps} />);

        const input = screen.getByPlaceholderText(
            'Ask me anything or use /cmd to execute commands...'
        );

        fireEvent.change(input, { target: { value: '/command pwd' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(mockOnExecuteCommand).toHaveBeenCalledWith('pwd');
        });
    });

    it('handles Enter key without Shift to send message', async () => {
        render(<AIAssistant {...defaultProps} />);

        const input = screen.getByPlaceholderText(
            'Ask me anything or use /cmd to execute commands...'
        );

        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(screen.getByText('Test message')).toBeInTheDocument();
        });
    });

    it('does not send message on Shift+Enter', () => {
        render(<AIAssistant {...defaultProps} />);

        const input = screen.getByPlaceholderText(
            'Ask me anything or use /cmd to execute commands...'
        );

        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.keyDown(input, {
            key: 'Enter',
            code: 'Enter',
            shiftKey: true,
        });

        // Message should not be sent, so it shouldn't appear in the chat messages
        const chatMessages = screen.getByTestId('chat-messages');

        // The message should only appear in the input, not in the chat
        expect(chatMessages).not.toHaveTextContent('Test message');
    });

    it('disables send button when input is empty', () => {
        render(<AIAssistant {...defaultProps} />);

        const sendButton = screen.getByRole('button', { name: 'Send' });
        expect(sendButton).toBeDisabled();
    });

    it('enables send button when input has content', () => {
        render(<AIAssistant {...defaultProps} />);

        const input = screen.getByPlaceholderText(
            'Ask me anything or use /cmd to execute commands...'
        );
        const sendButton = screen.getByRole('button', { name: 'Send' });

        fireEvent.change(input, { target: { value: 'Test' } });

        expect(sendButton).not.toBeDisabled();
    });

    it('shows loading state when processing message', async () => {
        render(<AIAssistant {...defaultProps} />);

        const input = screen.getByPlaceholderText(
            'Ask me anything or use /cmd to execute commands...'
        );
        const sendButton = screen.getByRole('button', { name: 'Send' });

        fireEvent.change(input, { target: { value: 'Hello' } });
        fireEvent.click(sendButton);

        expect(screen.getByText('Thinking...')).toBeInTheDocument();
        expect(screen.getByText('Sending...')).toBeInTheDocument();

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Send' })
            ).toBeInTheDocument();
        });
    });

    it('clears input after sending message', async () => {
        render(<AIAssistant {...defaultProps} />);

        const input = screen.getByPlaceholderText(
            'Ask me anything or use /cmd to execute commands...'
        ) as HTMLTextAreaElement;
        const sendButton = screen.getByRole('button', { name: 'Send' });

        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(input.value).toBe('');
        });
    });

    it('handles command execution error', async () => {
        mockOnExecuteCommand.mockRejectedValue(new Error('Command failed'));

        render(<AIAssistant {...defaultProps} />);

        const input = screen.getByPlaceholderText(
            'Ask me anything or use /cmd to execute commands...'
        );

        fireEvent.change(input, { target: { value: '/cmd invalid-command' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(
                screen.getByText(/Error executing command/)
            ).toBeInTheDocument();
        });
    });
});
