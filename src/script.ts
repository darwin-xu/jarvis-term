// Client-side TypeScript interfaces
interface Terminal {
    open(element: HTMLElement): void;
    focus(): void;
    write(data: string): void;
    loadAddon(addon: any): void;
    onData(callback: (data: string) => void): { dispose(): void };
    onFocus(callback: () => void): void;
    onBlur(callback: () => void): void;
    cols: number;
    rows: number;
}

interface FitAddon {
    fit(): void;
}

interface TerminalConstructor {
    new (options: any): Terminal;
}

interface FitAddonConstructor {
    new (): FitAddon;
}

interface WindowWithTerminal extends Window {
    Terminal: TerminalConstructor;
    FitAddon: { FitAddon: FitAddonConstructor };
    dataDisposable?: { dispose(): void };
}

declare const customWindow: WindowWithTerminal;

// Extend window interface to include APP_CONFIG
interface AppConfig {
    OPENAI_API_KEY: string;
}

interface CommandLogEntry {
    command: string;
    output: string;
    timestamp: string;
    executionTime: number;
    isTimeout?: boolean;
}

interface AIMessage {
    content: string;
    isUser: boolean;
    messageType: string;
    timestamp: number;
}

let term: Terminal;
let fitAddon: FitAddon;
let socket: WebSocket;
let isConnected = false;
let reconnectTimeout: number | undefined;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let waitingForKey = false;
let manualClose = false;
let bufferIndex = 0;

function log(...args: any[]): void {
    console.log(new Date().toISOString(), ...args);
}

function showConnectForm(): void {
    const form = document.getElementById('connect-form') as HTMLElement;
    form.style.display = 'flex';
}

function scheduleReconnect(): void {
    const stored = localStorage.getItem('sessionId');
    if (!stored) {
        showConnectForm();
        return;
    }
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        updateStatus('Retry limit reached. Press any key to retry.', true);
        waitingForKey = true;
        return;
    }
    const delay = Math.min(15000, 1000 * Math.pow(2, reconnectAttempts));
    log(`Scheduling reconnect attempt ${reconnectAttempts + 1} in ${delay}ms`);
    updateStatus(`Reconnecting in ${Math.round(delay / 1000)}s...`, true);
    reconnectTimeout = (window as any).setTimeout(() => {
        reconnectAttempts++;
        startConnection(
            `sessionId=${encodeURIComponent(stored)}&since=${bufferIndex}`
        );
    }, delay);
}

function handleKeyRetry(): void {
    if (!waitingForKey) {
        return;
    }
    waitingForKey = false;
    reconnectAttempts = 0;
    log('Manual key press triggered reconnect');
    const stored = localStorage.getItem('sessionId');
    if (stored) {
        startConnection(
            `sessionId=${encodeURIComponent(stored)}&since=${bufferIndex}`
        );
    }
}

function clearReconnect(): void {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = undefined;
        reconnectAttempts = 0;
        waitingForKey = false;
    }
}

function terminateSession(): void {
    const stored = localStorage.getItem('sessionId');
    if (!stored) {
        return;
    }
    fetch('/sessions/terminate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: stored }),
    }).catch(err => console.warn('Terminate session failed', err));
    localStorage.removeItem('sessionId');
}

async function checkAuth(): Promise<boolean> {
    const res = await fetch('/auth/check', {
        credentials: 'include',
    });
    const data = (await res.json()) as { authenticated: boolean };
    return data.authenticated;
}

async function requireAuth(): Promise<boolean> {
    const ok = await checkAuth();
    const overlay = document.getElementById('login-overlay') as HTMLElement;
    overlay.style.display = ok ? 'none' : 'flex';
    return ok;
}

document
    .getElementById('login-form')!
    .addEventListener('submit', async (e: Event) => {
        e.preventDefault();
        const pw = (document.getElementById('server-pass') as HTMLInputElement)
            .value;
        const resp = await fetch('/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw }),
        });
        if (resp.ok) {
            (
                document.getElementById('login-overlay') as HTMLElement
            ).style.display = 'none';
        } else {
            alert('Invalid password');
        }
    });

// Function to resize terminal to fit container
function resizeTerminal(): void {
    if (term && fitAddon) {
        try {
            fitAddon.fit();
            log(`Terminal resized to: ${term.cols}x${term.rows}`);

            // Send resize info to server if connected
            if (socket && socket.readyState === WebSocket.OPEN && isConnected) {
                const { cols, rows } = term;
                socket.send(
                    JSON.stringify({
                        type: 'resize',
                        cols: cols,
                        rows: rows,
                    })
                );
            }
        } catch (error) {
            console.warn('Error resizing terminal:', error);
        }
    }
}

// Debounce resize function to avoid excessive calls
let resizeTimeout: number | undefined;
function debouncedResize(): void {
    clearTimeout(resizeTimeout);
    resizeTimeout = (window as any).setTimeout(resizeTerminal, 100);
}

// Function to initialize terminal with proper sizing
function initializeTerminal(): void {
    // Initialize terminal with responsive options
    term = new (window as any).Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
            background: '#000000',
            foreground: '#ffffff',
            cursor: '#ffffff',
            selection: 'rgba(255, 255, 255, 0.3)',
        },
    });

    // Fit addon for automatic resizing
    fitAddon = new (window as any).FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    const terminalElement = document.getElementById('terminal')!;
    term.open(terminalElement);

    // Wait for the DOM to be fully rendered and CSS applied
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Check if container has proper dimensions
            const container = document.getElementById('terminal-container')!;
            log(
                `Container dimensions: ${container.offsetWidth}x${container.offsetHeight}`
            );

            // Multiple resize attempts to ensure proper sizing
            resizeTerminal();
            setTimeout(resizeTerminal, 50);
            setTimeout(resizeTerminal, 150);
            setTimeout(resizeTerminal, 300);
        });
    });

    // Listen for window resize events
    window.addEventListener('resize', debouncedResize);

    // Listen for orientation change on mobile devices
    window.addEventListener('orientationchange', () => {
        setTimeout(debouncedResize, 500);
    });

    // Handle terminal focus/blur for better UX
    term.onFocus(() => {
        (
            document.getElementById('terminal-container') as HTMLElement
        ).style.borderColor = '#007acc';
    });

    term.onBlur(() => {
        (
            document.getElementById('terminal-container') as HTMLElement
        ).style.borderColor = 'transparent';
    });

    // Focus terminal
    term.focus();
}

// Initialize terminal when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTerminal);
} else {
    initializeTerminal();
}

function updateStatus(message: string, isError = false): void {
    const status = document.getElementById('status') as HTMLElement;
    status.textContent = message;
    status.style.display = 'block';
    status.style.color = isError ? '#ff6b6b' : '#00ff00';

    if (!isError) {
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
}

function startConnection(query: string): void {
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    manualClose = false;
    clearReconnect();
    log('Opening WebSocket');
    socket = new WebSocket(`${wsProtocol}//${location.host}/terminal?${query}`);

    socket.onopen = () => {
        isConnected = true;
        log('WebSocket opened');
        updateStatus('SSH connecting...');
        (document.getElementById('connect-form') as HTMLElement).style.display =
            'none';
        clearReconnect();
    };

    socket.onmessage = (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data);

            if (typeof data !== 'object' || data === null || !data.type) {
                throw new Error('Not a structured control message');
            }

            if (data.type === 'error') {
                updateStatus(data.message, true);
                clearReconnect();
                if (
                    data.message.includes('Invalid session') ||
                    data.message.includes('Missing SSH')
                ) {
                    manualClose = true;
                    localStorage.removeItem('sessionId');
                }
                showConnectForm();
            } else if (data.type === 'ready') {
                clearReconnect();
                if (data.sessionId) {
                    localStorage.setItem('sessionId', data.sessionId);
                }
                updateStatus('Connected');
                const sendTerminalSize = () => {
                    if (term && fitAddon) {
                        try {
                            fitAddon.fit();
                            const { cols, rows } = term;
                            socket.send(
                                JSON.stringify({
                                    type: 'resize',
                                    cols,
                                    rows,
                                })
                            );
                        } catch (error) {
                            console.warn('Error sending terminal size:', error);
                        }
                    }
                };
                sendTerminalSize();
                setTimeout(sendTerminalSize, 100);
            }
        } catch {
            // Capture output for command execution
            captureTerminalOutput(e.data);
            term.write(e.data);
            bufferIndex++;
        }
    };

    socket.onclose = (event: CloseEvent) => {
        isConnected = false;
        log('WebSocket closed', event);
        if (event.wasClean) {
            updateStatus('Connection closed', true);
        } else {
            updateStatus('Connection lost', true);
        }
        if (manualClose) {
            term.write('\r\n\x1b[31mConnection closed.\x1b[0m\r\n');
            bufferIndex = 0;
            showConnectForm();
        } else {
            scheduleReconnect();
        }
    };

    socket.onerror = () => {
        isConnected = false;
        log('WebSocket error');
        updateStatus('Connection failed', true);
        if (!manualClose) {
            scheduleReconnect();
        } else {
            bufferIndex = 0;
            showConnectForm();
        }
    };

    if ((window as any).dataDisposable) {
        (window as any).dataDisposable.dispose();
    }
    (window as any).dataDisposable = term.onData((data: string) => {
        handleKeyRetry();
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'data', data }));
        }
    });
}

document
    .getElementById('connect-form')!
    .addEventListener('submit', async (e: Event) => {
        e.preventDefault();

        if (!(await requireAuth())) {
            return;
        }

        if (socket) {
            manualClose = true;
            clearReconnect();
            log('Closing existing WebSocket');
            socket.close();
            terminateSession();
        }

        const host = (
            document.getElementById('host') as HTMLInputElement
        ).value.trim();
        const user = (
            document.getElementById('user') as HTMLInputElement
        ).value.trim();
        const pass = (document.getElementById('pass') as HTMLInputElement)
            .value;

        if (!host || !user || !pass) {
            updateStatus('Please fill in all fields', true);
            return;
        }

        updateStatus('Connecting...');
        log(`Connecting to ${host} as ${user}`);
        bufferIndex = 0;
        const query = `host=${encodeURIComponent(host)}&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`;
        startConnection(query);
    });

(async () => {
    if (await requireAuth()) {
        const stored = localStorage.getItem('sessionId');
        if (stored) {
            startConnection(`sessionId=${encodeURIComponent(stored)}`);
        }
    }
})();

window.addEventListener('beforeunload', () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
        manualClose = true;
        log('Closing WebSocket before unload');
        socket.close();
    }
});
window.addEventListener('keydown', handleKeyRetry);

// AI Assistant functionality
let aiAssistantOpen = false;
let aiMessages: AIMessage[] = [];
let currentLLMProvider = 'openai'; // default
let customApiUrl = '';
let commandOutputLog: CommandLogEntry[] = []; // Store command outputs for AI context
let isExecutingCommand = false;
let commandOutputBuffer = '';
let commandStartTime: number | null = null;
let currentExecutingCommand: string | null = null; // Track currently executing command

// Config modal functions
function openConfigModal(): void {
    const overlay = document.getElementById('config-overlay') as HTMLElement;
    overlay.style.display = 'flex';
    loadConfigSettings();
}

function closeConfigModal(): void {
    const overlay = document.getElementById('config-overlay') as HTMLElement;
    overlay.style.display = 'none';
}

function loadConfigSettings(): void {
    const savedProvider = localStorage.getItem('llm-provider') || 'openai';
    const savedCustomUrl = localStorage.getItem('custom-api-url') || '';

    currentLLMProvider = savedProvider;
    customApiUrl = savedCustomUrl;

    const radioButton = document.querySelector(
        `input[name="llm-provider"][value="${savedProvider}"]`
    ) as HTMLInputElement;
    if (radioButton) {
        radioButton.checked = true;
        updateLLMOptionSelection(savedProvider);
    }

    const customUrlInput = document.getElementById(
        'custom-url-input'
    ) as HTMLInputElement;
    customUrlInput.value = savedCustomUrl;
    customUrlInput.disabled = savedProvider !== 'custom';
}

function selectLLMProvider(provider: string): void {
    const radioButton = document.querySelector(
        `input[name="llm-provider"][value="${provider}"]`
    ) as HTMLInputElement;
    if (radioButton) {
        radioButton.checked = true;
    }

    updateLLMOptionSelection(provider);
    currentLLMProvider = provider;
}

function updateLLMOptionSelection(provider: string): void {
    document.querySelectorAll('.llm-option').forEach(option => {
        option.classList.remove('selected');
    });

    const selectedOption = document
        .querySelector(`input[name="llm-provider"][value="${provider}"]`)!
        .closest('.llm-option') as HTMLElement;
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }

    const customUrlInput = document.getElementById(
        'custom-url-input'
    ) as HTMLInputElement;
    customUrlInput.disabled = provider !== 'custom';

    if (provider === 'custom') {
        customUrlInput.focus();
    }
}

function saveConfig(): void {
    const selectedProvider =
        (
            document.querySelector(
                'input[name="llm-provider"]:checked'
            ) as HTMLInputElement
        )?.value || 'openai';
    const customUrl = (
        document.getElementById('custom-url-input') as HTMLInputElement
    ).value.trim();

    if (selectedProvider === 'custom' && !customUrl) {
        alert('Please enter a custom API URL');
        return;
    }

    localStorage.setItem('llm-provider', selectedProvider);
    localStorage.setItem('custom-api-url', customUrl);

    currentLLMProvider = selectedProvider;
    customApiUrl = customUrl;

    closeConfigModal();

    addAIMessage(
        `Configuration updated! Using ${selectedProvider === 'custom' ? 'custom API' : selectedProvider} provider.`,
        false
    );
}

document
    .getElementById('config-overlay')!
    .addEventListener('click', (e: Event) => {
        if ((e.target as HTMLElement).id === 'config-overlay') {
            closeConfigModal();
        }
    });

document
    .getElementById('custom-url-input')!
    .addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveConfig();
        }
    });

async function executeCommand(
    command: string,
    display: boolean = true
): Promise<string> {
    if (!socket || socket.readyState !== WebSocket.OPEN || !isConnected) {
        const errorMsg =
            '❌ Error: Terminal not connected. Please connect to SSH first.';
        addAIMessage(errorMsg, false, 'error');
        throw new Error('Terminal not connected');
    }

    if (isExecutingCommand) {
        const errorMsg =
            '❌ Error: Another command is already executing. Please wait.';
        addAIMessage(errorMsg, false, 'error');
        throw new Error('Command already executing');
    }

    return new Promise<string>((resolve, reject) => {
        isExecutingCommand = true;
        commandOutputBuffer = '';
        commandStartTime = Date.now();
        currentExecutingCommand = command;

        if (display) {
            addAIMessage(
                `🔧 Executing command: \`${command}\``,
                false,
                'command'
            );
        }

        const commandToSend = command.trim() + '\n';
        socket.send(JSON.stringify({ type: 'data', data: commandToSend }));

        // Store the resolve/reject functions for later use
        (window as any).currentCommandResolve = resolve;
        (window as any).currentCommandReject = reject;

        setTimeout(() => {
            if (isExecutingCommand) {
                finishCommandExecution(
                    currentExecutingCommand || command,
                    true
                );
            }
        }, 60000);
    });
}

function finishCommandExecution(command: string, isTimeout = false): void {
    if (!isExecutingCommand) {
        console.log(
            'finishCommandExecution called but no command is executing'
        );
        return;
    }

    console.log('Finishing command execution', {
        command,
        isTimeout,
        executionTime: Date.now() - (commandStartTime || 0),
    });

    isExecutingCommand = false;
    currentExecutingCommand = null;
    const executionTime = Date.now() - (commandStartTime || 0);

    let cleanOutput = commandOutputBuffer
        .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI escape codes (colors, formatting)
        .replace(/\r\n/g, '\n') // Convert Windows line endings to Unix
        .replace(/\r/g, '\n') // Convert Mac line endings to Unix
        .trim(); // Remove leading/trailing whitespace

    const logEntry: CommandLogEntry = {
        command: command,
        output: cleanOutput,
        timestamp: new Date().toISOString(),
        executionTime: executionTime,
        isTimeout: isTimeout,
    };
    commandOutputLog.push(logEntry);

    if (commandOutputLog.length > 50) {
        commandOutputLog.shift();
    }

    try {
        localStorage.setItem(
            'command-output-log',
            JSON.stringify(commandOutputLog.slice(-20))
        );
    } catch (e) {
        console.warn('Failed to save command log to localStorage:', e);
    }

    saveCommandToServer(logEntry);

    if (isTimeout) {
        addAIMessage(
            '⏰ Command execution timeout (10s). Output captured so far:',
            false,
            'error'
        );
    }
    //  else {
    //     addAIMessage(
    //         `✅ Command completed in ${executionTime}ms`,
    //         false,
    //         'command'
    //     );
    // }

    // if (cleanOutput) {
    //     addAIMessage(`📄 Output:\n${cleanOutput}`, false, 'command-output');
    // } else {
    //     addAIMessage('📄 No output captured', false, 'command');
    // }

    commandOutputBuffer = '';

    // Resolve the Promise with the output
    const resolve = (window as any).currentCommandResolve;
    const reject = (window as any).currentCommandReject;

    if (resolve) {
        if (isTimeout) {
            reject(
                new Error(`Command timed out after 10s. Output: ${cleanOutput}`)
            );
        } else {
            resolve(cleanOutput);
        }
        // Clean up the stored promise handlers
        (window as any).currentCommandResolve = null;
        (window as any).currentCommandReject = null;
    }
}

function captureTerminalOutput(data: string): void {
    if (isExecutingCommand) {
        commandOutputBuffer += data;

        const promptPatterns = [
            /\$ $/m,
            /# $/m,
            /> $/m,
            /\] $/m,
            /% $/m,
            /➜ /m,
            /❯ /m,
            /\$\s*$/m,
            /#\s*$/m,
            /bash-[\d\.]+-\$ $/m,
            /zsh-[\d\.]+-% $/m,
        ];

        const hasPrompt = promptPatterns.some(pattern => pattern.test(data));

        if (hasPrompt) {
            console.log('Command prompt detected, finishing execution...', {
                command: currentExecutingCommand,
                elapsed: Date.now() - (commandStartTime || 0),
                dataSnippet: data.slice(-50),
            });

            setTimeout(() => {
                if (isExecutingCommand) {
                    let currentCommand = currentExecutingCommand || 'unknown';

                    if (!currentExecutingCommand) {
                        const lines = commandOutputBuffer.split('\n');
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            if (line && !line.match(/^\s*[\$#%➜❯>]/)) {
                                const commandMatch = line.match(/^\s*([^\s]+)/);
                                if (commandMatch) {
                                    currentCommand = commandMatch[1];
                                    break;
                                }
                            }
                        }
                    }

                    const minExecutionTime = 100;
                    const elapsed = Date.now() - (commandStartTime || 0);

                    console.log('About to finish command execution', {
                        command: currentCommand,
                        elapsed,
                        minExecutionTime,
                        willDelay: elapsed < minExecutionTime,
                    });

                    if (elapsed >= minExecutionTime) {
                        finishCommandExecution(currentCommand);
                    } else {
                        setTimeout(() => {
                            if (isExecutingCommand) {
                                console.log('Finishing command after delay');
                                finishCommandExecution(currentCommand);
                            }
                        }, minExecutionTime - elapsed);
                    }
                }
            }, 100);
        }
    }
}

function parseCommand(message: string): string | null {
    const commandPrefixes = ['/cmd', '/command', '/exec', '/run'];
    const lowercaseMessage = message.toLowerCase().trim();

    for (const prefix of commandPrefixes) {
        if (lowercaseMessage.startsWith(prefix + ' ')) {
            return message.substring(prefix.length + 1).trim();
        }
    }

    return null;
}

function loadCommandHistory(): void {
    try {
        const saved = localStorage.getItem('command-output-log');
        if (saved) {
            commandOutputLog = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load command history:', e);
        commandOutputLog = [];
    }
}

async function saveCommandToServer(logEntry: CommandLogEntry): Promise<void> {
    try {
        const sessionId = localStorage.getItem('sessionId') || 'unknown';
        const response = await fetch('/api/command-log', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...logEntry,
                sessionId: sessionId,
            }),
        });

        if (!response.ok) {
            console.warn(
                'Failed to save command log to server:',
                response.statusText
            );
        }
    } catch (error) {
        console.warn('Error saving command log to server:', error);
    }
}

function getCommandHistory(): CommandLogEntry[] {
    return commandOutputLog.slice();
}

function getRecentCommandContext(limit = 5): Array<{
    command: string;
    output: string;
    timestamp: string;
    success: boolean;
}> {
    const recent = commandOutputLog.slice(-limit);
    return recent.map(entry => ({
        command: entry.command,
        output: entry.output,
        timestamp: entry.timestamp,
        success:
            !entry.output.toLowerCase().includes('error') &&
            !entry.output.toLowerCase().includes('command not found'),
    }));
}

function formatCommandContextForAI(): string {
    const context = getRecentCommandContext();
    if (context.length === 0) {
        return 'No recent commands executed.';
    }

    return (
        'Recent command history:\n' +
        context
            .map(
                cmd =>
                    `Command: ${cmd.command}\nOutput: ${cmd.output.substring(0, 200)}${cmd.output.length > 200 ? '...' : ''}\nStatus: ${cmd.success ? 'Success' : 'Error'}\n`
            )
            .join('\n---\n')
    );
}

loadCommandHistory();

function toggleAIAssistant(): void {
    const pane = document.getElementById('ai-assistant-pane') as HTMLElement;
    const hint = document.getElementById('ai-toggle-hint') as HTMLElement;

    aiAssistantOpen = !aiAssistantOpen;

    if (aiAssistantOpen) {
        pane.classList.add('open');
        hint.classList.remove('show');
        setTimeout(() => {
            (document.getElementById('ai-input') as HTMLInputElement).focus();
        }, 300);
    } else {
        pane.classList.remove('open');
        if (term) {
            term.focus();
        }
    }
}

function showAIToggleHint(): void {
    if (!aiAssistantOpen) {
        const hint = document.getElementById('ai-toggle-hint') as HTMLElement;
        hint.classList.add('show');
        setTimeout(() => {
            hint.classList.remove('show');
        }, 3000);
    }
}

function addAIMessage(
    content: string,
    isUser = false,
    messageType = 'normal'
): void {
    const messagesContainer = document.getElementById(
        'ai-chat-messages'
    ) as HTMLElement;
    const messageDiv = document.createElement('div');

    let className = `ai-message ${isUser ? 'user' : 'assistant'}`;

    if (!isUser) {
        if (messageType === 'command') {
            className = 'ai-message command';
        } else if (messageType === 'command-output') {
            className = 'ai-message command-output';
        } else if (messageType === 'error') {
            className = 'ai-message error';
        }
    }

    messageDiv.className = className;
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    aiMessages.push({
        content,
        isUser,
        messageType,
        timestamp: Date.now(),
    });
}

const planSchema = {
    type: 'json_schema',
    name: 'AgentPlan',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            explanation: {
                type: 'string',
                description:
                    'A human-readable explanation of the plan or next steps.',
            },
            steps: {
                type: 'array',
                description: 'Ordered list of commands to be executed.',
                items: {
                    type: 'object',
                    properties: {
                        cmd: {
                            type: 'string',
                            description: 'The shell command to execute.',
                        },
                        output: {
                            type: 'string',
                            description:
                                'Captured standard output or error from execution. Can be empty before execution.',
                        },
                        exit: {
                            type: 'integer',
                            description:
                                'Exit code from command execution (0 means success).',
                        },
                        executed: {
                            type: 'boolean',
                            description: 'Whether this step has been executed.',
                        },
                        expectedDuration: {
                            type: 'integer',
                            description:
                                'Expected duration in milliseconds for this command to execute.',
                        },
                        dependsOnPreviousOutput: {
                            type: 'boolean',
                            description:
                                'Whether this command has arguments that depend on the output of previous commands.',
                        },
                    },
                    required: [
                        'cmd',
                        'output',
                        'exit',
                        'executed',
                        'expectedDuration',
                        'dependsOnPreviousOutput',
                    ],
                    additionalProperties: false,
                },
            },
        },
        required: ['explanation', 'steps'],
        additionalProperties: false,
    },
};

const planInstruction = `You are an AI agent designed to help users by providing the correct command lines to execute in a Linux terminal.
An autobot will execute the Linux commands and collect the output.
You will be given a goal from the user.
You will be provided with a history of the plan and the executed results.
You need to generate the following plan based on that information.
Briefly describe what you are going to do in the "explanation" field in the JSON section.
List all precise shell commands in the "steps" field in the JSON section.
If a command's arguments depend on the output of previous commands, mark it as "dependsOnPreviousOutput" and provide placeholders for the command's arguments.`;

// Get OPENAI_API_KEY from injected window config
const OPENAI_API_KEY = (window as any).APP_CONFIG?.OPENAI_API_KEY || '';

async function getPlan(goal: string, plan: any = null): Promise<string> {
    let prompt = [
        { role: 'system', content: planInstruction },
        {
            role: 'user',
            content: plan
                ? `The goal is: ${goal}. The result of the executed plan is: ${JSON.stringify(plan)}. ` +
                  `If the goal is not achieved, please provide a new plan to achieve this goal.`
                : `The goal is: ${goal}. Please provide a plan to achieve this goal.`,
        },
    ];
    try {
        const response = await fetch(`http://35.234.22.51:8080/v1/responses`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                model: 'gpt-4.1-nano',
                input: prompt,
                text: {
                    format: planSchema,
                },
            }),
        });
        if (!response.ok) {
            return `Error: Failed to get response from OpenAI (${response.status})`;
        }
        const data = await response.json();

        return data.output?.[0].content?.[0]?.text;
    } catch (err) {
        return `Error: ${err}`;
    }
}

const summarySchema = {
    type: 'json_schema',
    name: 'AgentPlanSummary',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            achieve: {
                type: 'boolean',
                description: 'Whether the goal has been achieved.',
            },
            summary: {
                type: 'string',
                description:
                    'Human-readable summary of the overall execution outcome.',
            },
        },
        required: ['achieve', 'summary'],
        additionalProperties: false,
    },
};

const summaryInstruction = `You are an AI agent designed to help users by providing the correct command lines to execute in a Linux terminal.
Now the plan has been executed with result.
Please determine if the goal has been achieved based on the provided plan and execution results.
Please generate a summary if the goal has been achieved.`;

async function getSummary(result: string): Promise<string> {
    let prompt = [
        { role: 'system', content: summaryInstruction },
        { role: 'user', content: `The execution result is: ${result}` },
    ];
    const response = await fetch(`http://35.234.22.51:8080/v1/responses`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            model: 'gpt-4.1-nano',
            input: prompt,
            text: {
                format: summarySchema,
            },
        }),
    });
    if (!response.ok) {
        throw new Error(
            `Failed to get response from OpenAI (${response.status})`
        );
    }
    const data = await response.json();

    return data.output?.[0].content?.[0]?.text;
}

function sendAIMessage(): void {
    const input = document.getElementById('ai-input') as HTMLTextAreaElement;
    const sendBtn = document.getElementById('ai-send-btn') as HTMLButtonElement;
    const message = input.value.trim();

    input.value = '';

    if (!message) return;

    addAIMessage(message, true);

    JarvisExecute(message);
}

function getExitCode(output: string): number {
    // remove the first line if it doesn't contains the exit code
    const lines = output.split('\n');
    if (lines.length > 1 && !lines[0].trim().match(/^\d+$/)) {
        lines.shift(); // Remove the first line
    }
    // Check if the last line is an exit code
    return +lines[0].trim();
}

async function JarvisExecute(goal: string): Promise<void> {
    let plan = JSON.parse(await getPlan(goal));
    let retry = 30;
    do {
        try {
            if (!plan || typeof plan !== 'object') {
                addAIMessage(
                    '❌ Error: Invalid AI response format',
                    false,
                    'error'
                );
                return;
            }

            if (
                !plan.explanation ||
                !plan.steps ||
                !Array.isArray(plan.steps)
            ) {
                addAIMessage(
                    '❌ Error: Missing required fields in AI response',
                    false,
                    'error'
                );
                return;
            }

            addAIMessage(`🤖 Jarvis: ${plan.explanation}`, false, 'ai-plan');

            let success = true;
            for (const step of plan.steps) {
                if (step.executed) continue; // Skip already executed steps
                if (step.dependsOnPreviousOutput) {
                    addAIMessage(
                        `🔄 Command depends on previous command's output: ${step.cmd}.`,
                        false,
                        'ai-plan'
                    );
                    continue;
                }

                //
                try {
                    const output = await executeCommand(step.cmd);
                    step.output = output;
                    step.exit = getExitCode(
                        await executeCommand('echo $?', false)
                    );
                    console.log(
                        `Command "${step.cmd}" exited with code: ${step.exit}`
                    );
                    step.executed = true;

                    if (step.exit !== 0) {
                        success = false;
                        break;
                    }

                    //addAIMessage(`📄 -Output:\n${output}`, false, 'command-output');
                    console.log(
                        `Command "${step.cmd}" completed with output:`,
                        output
                    );
                } catch (error) {
                    console.error(`Command "${step.cmd}" failed:`, error);
                    addAIMessage(`❌ Command failed: ${error}`, false, 'error');
                    return;
                }
            }

            const result = JSON.parse(
                    await getSummary(JSON.stringify(plan))
                );

            if (result.achieve) {
                addAIMessage(
                    `✅ Goal achieved! Summary: ${result.summary}`,
                    false,
                    'ai-summary'
                );
                return;
            }
            else {
                // Remove unexecuted steps from the plan
                plan.steps = plan.steps.filter((step: any) => step.executed);

                let newplan = JSON.parse(await getPlan(goal, plan));
                // join the newplan
                plan = { ...plan, ...newplan };
            }

            // if (success) {
            //     const summary = JSON.parse(
            //         await getSummary(JSON.stringify(plan))
            //     );
            //     if (summary) {
            //         addAIMessage(
            //             `✅ Summary: ${summary.summary}.`,
            //             false,
            //             'ai-summary'
            //         );
            //     }
            //     return;
            // } else {
            //     // Remove unexecuted steps from the plan
            //     plan.steps = plan.steps.filter((step: any) => step.executed);

            //     let newplan = JSON.parse(await getPlan(goal, plan));
            //     // join the newplan
            //     plan = { ...plan, ...newplan };
            // }
        } catch (err) {
            addAIMessage(
                `❌ Error parsing AI response: ${err}`,
                false,
                'error'
            );
            return;
        }
    } while (retry-- > 0);
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        toggleAIAssistant();
    }
});

document
    .getElementById('ai-input')!
    .addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAIMessage();
        }
    });

document
    .getElementById('ai-input')!
    .addEventListener('input', function (this: HTMLTextAreaElement) {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

setTimeout(showAIToggleHint, 2000);
