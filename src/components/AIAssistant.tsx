import React, { useState, useRef, useEffect } from 'react';
import { AIMessage } from '../types';

interface AIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenConfig: () => void;
    onExecuteCommand: (command: string) => Promise<void>;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
    isOpen,
    onClose,
    onOpenConfig,
    onExecuteCommand,
}) => {
    const [messages, setMessages] = useState<AIMessage[]>([
        {
            id: '1',
            content:
                "Hello! I'm your AI assistant. I can help you with terminal commands and answer questions about your system.\n\nTo execute terminal commands, use one of these prefixes:\n• /cmd <command>\n• /command <command>\n• /exec <command>\n• /run <command>\n\nExample: /cmd ls -la",
            isUser: false,
            timestamp: new Date(),
        },
    ]);
    const [inputValue, setInputValue] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const scrollToBottom = (): void => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const parseCommand = (message: string): string | null => {
        const commandPrefixes = ['/cmd ', '/command ', '/exec ', '/run '];
        for (const prefix of commandPrefixes) {
            if (message.toLowerCase().startsWith(prefix)) {
                return message.substring(prefix.length).trim();
            }
        }
        return null;
    };

    const addMessage = (content: string, isUser: boolean): void => {
        const newMessage: AIMessage = {
            id: Date.now().toString(),
            content,
            isUser,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, newMessage]);
    };

    const handleSendMessage = async (): Promise<void> => {
        if (!inputValue.trim() || isLoading) return;

        const message = inputValue.trim();
        setInputValue('');
        addMessage(message, true);

        // Check if this is a command
        const command = parseCommand(message);
        if (command) {
            try {
                await onExecuteCommand(command);
                addMessage(`Executed command: ${command}`, false);
            } catch (error) {
                addMessage(`Error executing command: ${error}`, false);
            }
            return;
        }

        // Regular AI message handling (placeholder for now)
        setIsLoading(true);
        setTimeout(() => {
            const helpText = `I'm a placeholder AI response. To execute commands, use one of these prefixes:
• /cmd <command> - Execute a terminal command
• /command <command> - Execute a terminal command  
• /exec <command> - Execute a terminal command
• /run <command> - Execute a terminal command

Example: /cmd ls -la`;
            addMessage(helpText, false);
            setIsLoading(false);
        }, 1000);
    };

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLTextAreaElement>
    ): void => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleInputChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>
    ): void => {
        setInputValue(e.target.value);

        // Auto-resize textarea
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    };

    const getMessageClass = (message: AIMessage): string => {
        return `ai-message ${message.isUser ? 'user' : 'assistant'}`;
    };

    if (!isOpen) return null;

    return (
        <div className={`ai-assistant-pane ${isOpen ? 'open' : ''}`}>
            <div className="ai-assistant-header">
                <span>AI Assistant</span>
                <div className="header-buttons">
                    <button
                        className="config-btn"
                        onClick={onOpenConfig}
                        title="Settings"
                    >
                        ⚙️
                    </button>
                    <button
                        className="close-btn"
                        onClick={onClose}
                        title="Close (Cmd+I)"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className="ai-chat-container">
                <div className="ai-chat-messages" data-testid="chat-messages">
                    {messages.map(message => (
                        <div
                            key={message.id}
                            className={getMessageClass(message)}
                        >
                            {message.content}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="ai-message assistant">Thinking...</div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="ai-input-container">
                    <textarea
                        ref={inputRef}
                        className="ai-input"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me anything or use /cmd to execute commands..."
                        disabled={isLoading}
                        rows={1}
                    />
                    <button
                        className="ai-send-btn"
                        onClick={handleSendMessage}
                        disabled={isLoading || !inputValue.trim()}
                    >
                        {isLoading ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
};
