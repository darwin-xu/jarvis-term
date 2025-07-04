import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

function useAuth() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/auth/check', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setAuthenticated(data.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const login = async (password: string) => {
    const res = await fetch('/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
    } else {
      throw new Error('Login failed');
    }
  };

  return { authenticated, login };
}

let connectFn: ((host: string, user: string, pass: string, port: number) => void) | null = null;

const TerminalView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal>();
  const fitRef = useRef<FitAddon>();
  const socketRef = useRef<WebSocket>();
  const [status, setStatus] = useState('Disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const connect = (host: string, user: string, pass: string, port: number) => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    const params = new URLSearchParams({ host, user, pass, port: String(port) });
    if (sessionId) params.append('sessionId', sessionId);
    const ws = new WebSocket(`${location.origin.replace('http', 'ws')}/terminal?${params.toString()}`);
    socketRef.current = ws;
    setStatus('Connecting...');

    ws.onopen = () => setStatus('Connected');

    ws.onmessage = evt => {
      const data = evt.data as string;
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'ready') {
          setSessionId(msg.sessionId);
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        } else if (msg.type === 'error') {
          setStatus(msg.message || 'error');
        }
      } catch {
        termRef.current?.write(data);
      }
    };

    ws.onclose = () => setStatus('Disconnected');
  };

  useEffect(() => {
    connectFn = connect;
    return () => {
      connectFn = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (containerRef.current && !termRef.current) {
      const term = new Terminal({ convertEol: true });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();
      termRef.current = term;
      fitRef.current = fitAddon;

      term.onData(d => {
        socketRef.current?.send(JSON.stringify({ type: 'data', data: d }));
      });

      window.addEventListener('resize', () => fitAddon.fit());
    }
  }, []);

  return (
    <div id="terminal-container">
      <div id="terminal" ref={containerRef}></div>
      <div className="status" id="status">{status}</div>
    </div>
  );
};

const App: React.FC = () => {
  const { authenticated, login } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ content: string; user: boolean }[]>([
    { content: "Hi! I'm your AI assistant. Use /cmd <command> to run commands.", user: false },
  ]);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!authenticated) {
      setShowLogin(true);
    }
  }, [authenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = document.getElementById('server-pass') as HTMLInputElement;
    try {
      await login(input.value);
      setShowLogin(false);
    } catch {
      alert('Invalid password');
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const host = (document.getElementById('host') as HTMLInputElement).value;
    const user = (document.getElementById('user') as HTMLInputElement).value;
    const pass = (document.getElementById('pass') as HTMLInputElement).value;
    const port = parseInt(
      (document.getElementById('port') as HTMLInputElement | null)?.value || '22',
      10,
    );
    (window as any).terminalConnect(host, user, pass, port);
  };

  return (
    <div className="container">
      {showLogin && (
        <div id="login-overlay" role="dialog" aria-modal="true">
          <form id="login-form" onSubmit={handleLogin}>
            <label htmlFor="server-pass">Server Password:</label>
            <input id="server-pass" type="password" required />
            <button type="submit">Login</button>
          </form>
        </div>
      )}
      <form id="connect-form" onSubmit={handleConnect}>
        <label htmlFor="host">Host:</label>
        <input id="host" name="host" placeholder="hostname or IP" required />
        <label htmlFor="user">User:</label>
        <input id="user" name="user" placeholder="username" required />
        <label htmlFor="pass">Password:</label>
        <input id="pass" name="pass" type="password" placeholder="password" required />
        <label htmlFor="port">Port:</label>
        <input id="port" name="port" type="number" defaultValue="22" />
        <button type="submit">Connect</button>
      </form>
      <div className="main-content">
        <div className="terminal-section">
          <TerminalView />
        </div>
        {aiOpen && (
          <div className="ai-assistant-pane open" id="ai-assistant-pane">
            <div className="ai-assistant-header">
              <span>AI Assistant</span>
              <div className="header-buttons">
                <button className="close-btn" onClick={() => setAiOpen(false)} title="Close">
                  ×
                </button>
              </div>
            </div>
            <div className="ai-chat-container">
              <div className="ai-chat-messages" id="ai-chat-messages">
                {aiMessages.map((m, i) => (
                  <div key={i} className={`ai-message ${m.user ? 'user' : 'assistant'}`}>{m.content}</div>
                ))}
              </div>
              <div className="ai-input-container">
                <textarea ref={aiInputRef} className="ai-input" placeholder="How can I assist you?" rows={1} />
                <button
                  className="ai-send-btn"
                  onClick={() => {
                    const val = aiInputRef.current?.value.trim();
                    if (!val) return;
                    setAiMessages(m => [...m, { content: val, user: true }]);
                    aiInputRef.current!.value = '';
                    setTimeout(() => {
                      setAiMessages(m => [...m, { content: 'This is a placeholder response.', user: false }]);
                    }, 1000);
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="ai-toggle-hint" id="ai-toggle-hint">
        <button onClick={() => setAiOpen(o => !o)}>Toggle AI</button>
      </div>
    </div>
  );
};

createRoot(document.getElementById('app')!).render(<App />);

// Expose connect function for event handler
(window as any).terminalConnect = (
  host: string,
  user: string,
  pass: string,
  port: number,
) => {
  if (connectFn) {
    connectFn(host, user, pass, port);
  }
};

