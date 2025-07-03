import React, { useEffect } from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { SSHConnectionConfig } from '../types';

interface TerminalProps {
    connectionConfig?: SSHConnectionConfig;
    onConnect?: () => void;
    onDisconnect?: () => void;
}

export const Terminal: React.FC<TerminalProps> = ({
    connectionConfig,
    onConnect,
    onDisconnect,
}) => {
    const {
        terminalRef,
        connectionStatus,
        statusMessage,
        connect,
        disconnect,
        resize,
    } = useTerminal();

    useEffect(() => {
        if (connectionConfig) {
            connect(connectionConfig);
            onConnect?.();
        }

        return () => {
            disconnect();
            onDisconnect?.();
        };
    }, [connectionConfig]);

    useEffect(() => {
        // Handle window resize
        const handleResize = (): void => {
            setTimeout(() => resize(), 100);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [resize]);

    const getStatusIndicatorClass = (): string => {
        switch (connectionStatus) {
            case 'connected':
                return 'status-indicator';
            case 'connecting':
                return 'status-indicator connecting';
            case 'disconnected':
                return 'status-indicator disconnected';
            default:
                return 'status-indicator disconnected';
        }
    };

    return (
        <div className="terminal-section">
            <div className="status">
                <div className={getStatusIndicatorClass()}></div>
                <span>{statusMessage}</span>
            </div>
            <div className="terminal-container">
                <div
                    ref={terminalRef}
                    style={{ height: '100%', width: '100%' }}
                />
            </div>
        </div>
    );
};
