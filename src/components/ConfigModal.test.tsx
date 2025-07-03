import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../test/utils';
import { ConfigModal } from './ConfigModal';

describe('ConfigModal Component', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn();

    const defaultProps = {
        isOpen: true,
        onClose: mockOnClose,
        onSave: mockOnSave,
        initialSettings: {
            aiApiKey: '',
            aiModel: 'gpt-3.5-turbo',
            theme: 'dark' as const,
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders when open', () => {
        render(<ConfigModal {...defaultProps} />);

        expect(screen.getByText('Configuration')).toBeInTheDocument();
        expect(screen.getByText('AI Settings')).toBeInTheDocument();
        expect(screen.getByText('Appearance')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        render(<ConfigModal {...defaultProps} isOpen={false} />);

        expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
    });

    it('displays initial settings values', () => {
        const settings = {
            aiApiKey: 'test-key',
            aiModel: 'gpt-4',
            theme: 'light' as const,
        };

        render(<ConfigModal {...defaultProps} initialSettings={settings} />);

        const apiKeyInput = screen.getByDisplayValue('test-key');
        const modelSelect = screen.getByLabelText('Model') as HTMLSelectElement;
        const themeSelect = screen.getByLabelText('Theme') as HTMLSelectElement;

        expect(apiKeyInput).toBeInTheDocument();
        expect(modelSelect.value).toBe('gpt-4');
        expect(themeSelect.value).toBe('light');
    });

    it('calls onClose when close button is clicked', () => {
        render(<ConfigModal {...defaultProps} />);

        const closeButton = screen.getByRole('button', { name: '✕' });
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when cancel button is clicked', () => {
        render(<ConfigModal {...defaultProps} />);

        const cancelButton = screen.getByRole('button', { name: 'Cancel' });
        fireEvent.click(cancelButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onSave with updated settings when save is clicked', () => {
        render(<ConfigModal {...defaultProps} />);

        const apiKeyInput = screen.getByLabelText('API Key');
        const saveButton = screen.getByRole('button', { name: 'Save' });

        fireEvent.change(apiKeyInput, { target: { value: 'new-api-key' } });
        fireEvent.click(saveButton);

        expect(mockOnSave).toHaveBeenCalledWith({
            aiApiKey: 'new-api-key',
            aiModel: 'gpt-3.5-turbo',
            theme: 'dark',
        });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('updates AI model selection', () => {
        render(<ConfigModal {...defaultProps} />);

        const modelSelect = screen.getByLabelText('Model');
        fireEvent.change(modelSelect, { target: { value: 'claude-3-sonnet' } });

        expect(modelSelect).toHaveValue('claude-3-sonnet');
    });

    it('updates theme selection', () => {
        render(<ConfigModal {...defaultProps} />);

        const themeSelect = screen.getByLabelText('Theme');
        fireEvent.change(themeSelect, { target: { value: 'light' } });

        expect(themeSelect).toHaveValue('light');
    });

    it('resets settings when cancel is clicked after changes', () => {
        const initialSettings = {
            aiApiKey: 'original-key',
            aiModel: 'gpt-3.5-turbo',
            theme: 'dark' as const,
        };

        render(
            <ConfigModal {...defaultProps} initialSettings={initialSettings} />
        );

        const apiKeyInput = screen.getByLabelText('API Key');
        const cancelButton = screen.getByRole('button', { name: 'Cancel' });

        // Make changes
        fireEvent.change(apiKeyInput, { target: { value: 'modified-key' } });

        // Cancel changes
        fireEvent.click(cancelButton);

        expect(mockOnSave).not.toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('has all AI model options available', () => {
        render(<ConfigModal {...defaultProps} />);

        const modelSelect = screen.getByLabelText('Model');
        const options = Array.from(modelSelect.querySelectorAll('option')).map(
            option => option.value
        );

        expect(options).toEqual([
            'gpt-3.5-turbo',
            'gpt-4',
            'claude-3-sonnet',
            'claude-3-haiku',
        ]);
    });

    it('has theme options available', () => {
        render(<ConfigModal {...defaultProps} />);

        const themeSelect = screen.getByLabelText('Theme');
        const options = Array.from(themeSelect.querySelectorAll('option')).map(
            option => option.value
        );

        expect(options).toEqual(['dark', 'light']);
    });

    it('handles empty initial settings', () => {
        render(<ConfigModal {...defaultProps} initialSettings={{}} />);

        const apiKeyInput = screen.getByLabelText(
            'API Key'
        ) as HTMLInputElement;
        const modelSelect = screen.getByLabelText('Model') as HTMLSelectElement;
        const themeSelect = screen.getByLabelText('Theme') as HTMLSelectElement;

        expect(apiKeyInput.value).toBe('');
        expect(modelSelect.value).toBe('gpt-3.5-turbo');
        expect(themeSelect.value).toBe('dark');
    });
});
