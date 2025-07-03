import React, { useState, useEffect } from 'react';
import { ConfigModalSettings } from '../types';

interface ConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: ConfigModalSettings) => void;
    initialSettings?: ConfigModalSettings;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialSettings = {},
}) => {
    const [settings, setSettings] = useState<ConfigModalSettings>(() => ({
        ...initialSettings,
    }));

    // Sync settings with initialSettings when they change
    useEffect(() => {
        setSettings({ ...initialSettings });
    }, [initialSettings]);

    const handleInputChange = (
        key: keyof ConfigModalSettings,
        value: string
    ): void => {
        setSettings(prev => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleSave = (): void => {
        onSave(settings);
        onClose();
    };

    const handleCancel = (): void => {
        setSettings({ ...initialSettings });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="config-overlay">
            <div className="config-modal">
                <div className="config-header">
                    <h3>Configuration</h3>
                    <button className="close-btn" onClick={handleCancel}>
                        ✕
                    </button>
                </div>

                <div className="config-content">
                    <div className="config-section">
                        <h4>AI Settings</h4>
                        <div className="form-group">
                            <label htmlFor="ai-api-key">API Key</label>
                            <input
                                id="ai-api-key"
                                type="password"
                                value={settings.aiApiKey || ''}
                                onChange={e =>
                                    handleInputChange(
                                        'aiApiKey',
                                        e.target.value
                                    )
                                }
                                placeholder="Enter your AI API key"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="ai-model">Model</label>
                            <select
                                id="ai-model"
                                value={settings.aiModel || 'gpt-3.5-turbo'}
                                onChange={e =>
                                    handleInputChange('aiModel', e.target.value)
                                }
                            >
                                <option value="gpt-3.5-turbo">
                                    GPT-3.5 Turbo
                                </option>
                                <option value="gpt-4">GPT-4</option>
                                <option value="claude-3-sonnet">
                                    Claude 3 Sonnet
                                </option>
                                <option value="claude-3-haiku">
                                    Claude 3 Haiku
                                </option>
                            </select>
                        </div>
                    </div>

                    <div className="config-section">
                        <h4>Appearance</h4>
                        <div className="form-group">
                            <label htmlFor="theme">Theme</label>
                            <select
                                id="theme"
                                value={settings.theme || 'dark'}
                                onChange={e =>
                                    handleInputChange(
                                        'theme',
                                        e.target.value as 'dark' | 'light'
                                    )
                                }
                            >
                                <option value="dark">Dark</option>
                                <option value="light">Light</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="config-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};
