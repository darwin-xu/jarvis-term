"use strict";
/// <reference types="react" />
const { useEffect, useRef, useState } = React;
const PING_INTERVAL = 15000;
function App() {
    const terminalRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [aiOpen, setAiOpen] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const termRef = useRef(null);
    const fitRef = useRef(null);
    const pingRef = useRef(null);
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
            if (pingRef.current)
                clearInterval(pingRef.current);
            if (socket)
                socket.close();
        };
    }, [socket]);
    const connect = (query) => {
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
            if (!term)
                return;
            try {
                const data = JSON.parse(ev.data);
                if (data.type === 'ready') {
                    localStorage.setItem('sessionId', data.sessionId);
                }
                else if (data.type === 'pong') {
                    // ignore
                }
                else if (data.type === 'error') {
                    term.writeln(`\x1b[31m${data.message}\x1b[0m`);
                }
            }
            catch (_a) {
                term.write(ev.data);
            }
        };
        ws.onclose = () => {
            setConnected(false);
            if (pingRef.current)
                clearInterval(pingRef.current);
        };
    };
    const handleLogin = async (e) => {
        e.preventDefault();
        const pw = e.currentTarget.elements.namedItem('server-pass').value;
        await fetch('/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
    };
    const handleConnect = (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const host = form.elements.namedItem('host').value;
        const user = form.elements.namedItem('user').value;
        const pass = form.elements.namedItem('pass').value;
        connect(`host=${encodeURIComponent(host)}&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`);
    };
    const sendMessage = () => {
        // placeholder AI
        const input = document.getElementById('ai-input');
        const text = input.value.trim();
        if (!text)
            return;
        setMessages(m => [...m, { content: text, sender: 'user' }]);
        input.value = '';
        setTimeout(() => {
            setMessages(m => [...m, { content: 'AI response placeholder.', sender: 'assistant' }]);
        }, 500);
    };
    return (React.createElement("div", { className: "container" },
        React.createElement("form", { id: "login-form", onSubmit: handleLogin, style: { display: 'none' } },
            React.createElement("label", { htmlFor: "server-pass" }, "Server Password:"),
            React.createElement("input", { id: "server-pass", name: "server-pass", type: "password", required: true }),
            React.createElement("button", { type: "submit" }, "Login")),
        React.createElement("form", { id: "connect-form", onSubmit: handleConnect },
            React.createElement("label", { htmlFor: "host" }, "Host:"),
            React.createElement("input", { id: "host", name: "host", required: true, placeholder: "hostname" }),
            React.createElement("label", { htmlFor: "user" }, "User:"),
            React.createElement("input", { id: "user", name: "user", required: true, placeholder: "user" }),
            React.createElement("label", { htmlFor: "pass" }, "Password:"),
            React.createElement("input", { id: "pass", name: "pass", type: "password", required: true }),
            React.createElement("button", { type: "submit" }, "Connect")),
        React.createElement("div", { className: "main-content" },
            React.createElement("div", { className: "terminal-section" },
                React.createElement("div", { id: "terminal-container" },
                    React.createElement("div", { id: "terminal", ref: terminalRef }))),
            React.createElement("div", { className: `ai-assistant-pane${aiOpen ? ' open' : ''}`, id: "ai-assistant-pane" },
                React.createElement("div", { className: "ai-assistant-header" },
                    React.createElement("span", null, "AI Assistant"),
                    React.createElement("div", { className: "header-buttons" },
                        React.createElement("button", { className: "close-btn", onClick: () => setAiOpen(false) }, "\u00D7"))),
                React.createElement("div", { className: "ai-chat-container" },
                    React.createElement("div", { className: "ai-chat-messages", id: "ai-chat-messages" }, messages.map((m, i) => (React.createElement("div", { key: i, className: `ai-message ${m.sender === 'user' ? 'user' : 'assistant'}` }, m.content)))),
                    React.createElement("div", { className: "ai-input-container" },
                        React.createElement("textarea", { id: "ai-input", className: "ai-input", rows: 1, placeholder: "Ask something" }),
                        React.createElement("button", { id: "ai-send-btn", className: "ai-send-btn", type: "button", onClick: sendMessage }, "Send")))))));
}
window.App = App;
