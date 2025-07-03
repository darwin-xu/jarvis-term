import { useState, useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { terminalService } from '../services/terminalService';
import { SSHConnectionConfig } from '../types';

interface UseTerminalReturn {
    terminalRef: React.RefObject<HTMLDivElement>;
    terminal: Terminal | null;
    connectionStatus: 'connected' | 'connecting' | 'disconnected';
    statusMessage: string;
    connect: (config: SSHConnectionConfig) => void;
    disconnect: () => void;
    executeCommand: (command: string) => Promise<void>;
    resize: () => void;
}

export const useTerminal = (): UseTerminalReturn => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const [terminal, setTerminal] = useState<Terminal | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<
        'connected' | 'connecting' | 'disconnected'
    >('disconnected');
    const [statusMessage, setStatusMessage] = useState<string>('Disconnected');

    useEffect(() => {
        if (terminalRef.current && !terminal) {
            const newTerminal = terminalService.initTerminal(
                terminalRef.current
            );
            setTerminal(newTerminal);
        }

        return () => {
            // Cleanup on unmount
            terminalService.disconnect();
        };
    }, [terminal]);

    const handleStatusChange = (
        status: 'connected' | 'connecting' | 'disconnected',
        message?: string
    ): void => {
        setConnectionStatus(status);
        setStatusMessage(message || status);
    };

    const connect = (config: SSHConnectionConfig): void => {
        terminalService.connect(config, handleStatusChange);
    };

    const disconnect = (): void => {
        terminalService.disconnect();
    };

    const executeCommand = async (command: string): Promise<void> => {
        await terminalService.executeCommand(command);
    };

    const resize = (): void => {
        terminalService.resize();
    };

    return {
        terminalRef,
        terminal,
        connectionStatus,
        statusMessage,
        connect,
        disconnect,
        executeCommand,
        resize,
    };
};
