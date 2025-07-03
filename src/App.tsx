import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Terminal } from './components/Terminal';
import { AIAssistant } from './components/AIAssistant';
import { ConfigModal } from './components/ConfigModal';
import { useAuth } from './hooks/useAuth';
import { useTerminal } from './hooks/useTerminal';
import { SSHConnectionConfig, ConfigModalSettings } from './types';
import './styles/main.css';
import './styles/ai-assistant.css';

const App: React.FC = () => {
    const { isAuthenticated, isLoading, login } = useAuth();
    const { executeCommand } = useTerminal();
    const [isAIAssistantOpen, setIsAIAssistantOpen] = useState<boolean>(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
    const [showHint, setShowHint] = useState<boolean>(false);
    const [configSettings, setConfigSettings] = useState<ConfigModalSettings>(
        {}
    );

    // Default SSH connection config (can be made configurable)
    const defaultSSHConfig: SSHConnectionConfig = {
        host: import.meta.env.VITE_SSH_HOST || 'localhost',
        username: import.meta.env.VITE_SSH_USER || 'user',
        password: import.meta.env.VITE_SSH_PASS || 'password',
        port: parseInt(import.meta.env.VITE_SSH_PORT || '22', 10),
    };

    useEffect(() => {
        // Load saved config from localStorage
        const savedConfig = localStorage.getItem('terminalConfig');
        if (savedConfig) {
            try {
                setConfigSettings(JSON.parse(savedConfig));
            } catch (error) {
                console.error('Error loading saved config:', error);
            }
        }

        // Show hint after 2 seconds
        const hintTimer = setTimeout(() => {
            setShowHint(true);
            setTimeout(() => setShowHint(false), 5000);
        }, 2000);

        return () => clearTimeout(hintTimer);
    }, []);

    useEffect(() => {
        // Handle Cmd+I keyboard shortcut for AI assistant
        const handleKeyDown = (e: KeyboardEvent): void => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                toggleAIAssistant();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const toggleAIAssistant = (): void => {
        setIsAIAssistantOpen(prev => !prev);
        setShowHint(false);
    };

    const handleCloseAIAssistant = (): void => {
        setIsAIAssistantOpen(false);
    };

    const handleOpenConfig = (): void => {
        setIsConfigModalOpen(true);
    };

    const handleCloseConfig = (): void => {
        setIsConfigModalOpen(false);
    };

    const handleSaveConfig = (settings: ConfigModalSettings): void => {
        setConfigSettings(settings);
        // Save to localStorage
        localStorage.setItem('terminalConfig', JSON.stringify(settings));
    };

    const handleExecuteCommand = async (command: string): Promise<void> => {
        try {
            await executeCommand(command);
        } catch (error) {
            console.error('Error executing command:', error);
            throw error;
        }
    };

    if (isLoading) {
        return <Login onLogin={login} isLoading={true} />;
    }

    if (!isAuthenticated) {
        return <Login onLogin={login} />;
    }

    return (
        <div className="container">
            <div className="main-content">
                <Terminal
                    connectionConfig={defaultSSHConfig}
                    onConnect={() => console.log('Terminal connected')}
                    onDisconnect={() => console.log('Terminal disconnected')}
                />

                <AIAssistant
                    isOpen={isAIAssistantOpen}
                    onClose={handleCloseAIAssistant}
                    onOpenConfig={handleOpenConfig}
                    onExecuteCommand={handleExecuteCommand}
                />

                {/* Hint to show users how to open AI assistant */}
                {showHint && !isAIAssistantOpen && (
                    <div className={`ai-toggle-hint ${showHint ? 'show' : ''}`}>
                        Press Cmd+I to open AI Assistant
                    </div>
                )}
            </div>

            <ConfigModal
                isOpen={isConfigModalOpen}
                onClose={handleCloseConfig}
                onSave={handleSaveConfig}
                initialSettings={configSettings}
            />
        </div>
    );
};

export default App;
