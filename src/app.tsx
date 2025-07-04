/// <reference types="react" />
const { useEffect, useRef, useState } = React;

declare const Terminal: any;
declare const FitAddon: any;

type Message = {
  content: string;
  sender: 'user' | 'assistant' | 'system';
};

const PING_INTERVAL = 15000;

function App() {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const pingRef = useRef<any>(null);

  useEffect(() => {
    if (terminalRef.current && !termRef.current) {
      const term = new Terminal({ cursorBlink: true });
      const fit = new FitAddon.FitAddon();
      term.loadAddon(fit);
      term.open(terminalRef.current);
      fit.fit();
      termRef.current = term;
      fitRef.current = fit;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (socket) socket.close();
    };
  }, [socket]);

  const connect = (query: string) => {
    const ws = new WebSocket(`/terminal?${query}`);
    setSocket(ws);
    ws.onopen = () => {
      setConnected(true);
      pingRef.current = setInterval(() => {
        ws.send(JSON.stringify({ type: 'ping' }));
      }, PING_INTERVAL);
    };
    ws.onmessage = ev => {
      const term = termRef.current;
      if (!term) return;
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'ready') {
          localStorage.setItem('sessionId', data.sessionId);
        } else if (data.type === 'pong') {
          // ignore
        } else if (data.type === 'error') {
          term.writeln(`\x1b[31m${data.message}\x1b[0m`);
        }
      } catch {
        term.write(ev.data);
      }
    };
    ws.onclose = () => {
      setConnected(false);
      if (pingRef.current) clearInterval(pingRef.current);
    };
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const pw = (e.currentTarget.elements.namedItem('server-pass') as HTMLInputElement).value;
    await fetch('/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
  };

  const handleConnect = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const host = (form.elements.namedItem('host') as HTMLInputElement).value;
    const user = (form.elements.namedItem('user') as HTMLInputElement).value;
    const pass = (form.elements.namedItem('pass') as HTMLInputElement).value;
    connect(`host=${encodeURIComponent(host)}&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`);
  };

  const sendMessage = () => {
    // placeholder AI
    const input = document.getElementById('ai-input') as HTMLTextAreaElement;
    const text = input.value.trim();
    if (!text) return;
    setMessages(m => [...m, { content: text, sender: 'user' }]);
    input.value = '';
    setTimeout(() => {
      setMessages(m => [...m, { content: 'AI response placeholder.', sender: 'assistant' }]);
    }, 500);
  };

  return (
    <div className="container">
      <form id="login-form" onSubmit={handleLogin} style={{ display: 'none' }}>
        <label htmlFor="server-pass">Server Password:</label>
        <input id="server-pass" name="server-pass" type="password" required />
        <button type="submit">Login</button>
      </form>
      <form id="connect-form" onSubmit={handleConnect}>
        <label htmlFor="host">Host:</label>
        <input id="host" name="host" required placeholder="hostname" />
        <label htmlFor="user">User:</label>
        <input id="user" name="user" required placeholder="user" />
        <label htmlFor="pass">Password:</label>
        <input id="pass" name="pass" type="password" required />
        <button type="submit">Connect</button>
      </form>
      <div className="main-content">
        <div className="terminal-section">
          <div id="terminal-container">
            <div id="terminal" ref={terminalRef}></div>
          </div>
        </div>
        <div className={`ai-assistant-pane${aiOpen ? ' open' : ''}`} id="ai-assistant-pane">
          <div className="ai-assistant-header">
            <span>AI Assistant</span>
            <div className="header-buttons">
              <button className="close-btn" onClick={() => setAiOpen(false)}>×</button>
            </div>
          </div>
          <div className="ai-chat-container">
            <div className="ai-chat-messages" id="ai-chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`ai-message ${m.sender === 'user' ? 'user' : 'assistant'}`}>{m.content}</div>
              ))}
            </div>
            <div className="ai-input-container">
              <textarea id="ai-input" className="ai-input" rows={1} placeholder="Ask something"></textarea>
              <button id="ai-send-btn" className="ai-send-btn" type="button" onClick={sendMessage}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.App = App;

