// @ts-nocheck
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TerminalView } from './Terminal';

const App: React.FC = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [host, setHost] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  const connect = () => {
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const query = `host=${encodeURIComponent(host)}&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`;
    const ws = new WebSocket(`${wsProtocol}//${location.host}/terminal?${query}`);
    ws.addEventListener('open', () => setConnected(true));
    ws.addEventListener('close', () => setConnected(false));
    setSocket(ws);
  };

  return (
    <div className="container">
      <form
        onSubmit={e => {
          e.preventDefault();
          connect();
        }}
      >
        <label>
          Host:
          <input value={host} onChange={e => setHost(e.target.value)} required />
        </label>
        <label>
          User:
          <input value={user} onChange={e => setUser(e.target.value)} required />
        </label>
        <label>
          Password:
          <input
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            required
          />
        </label>
        <button type="submit">Connect</button>
      </form>
      {connected && <TerminalView socket={socket} />}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
