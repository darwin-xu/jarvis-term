// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

interface TerminalProps {
  socket: WebSocket | null;
}

export const TerminalView: React.FC<TerminalProps> = ({ socket }) => {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal>();
  const fitRef = useRef<FitAddon>();

  useEffect(() => {
    if (!ref.current) return;
    const term = new Terminal();
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(ref.current);
    fitAddon.fit();
    termRef.current = term;
    fitRef.current = fitAddon;

    const resize = () => fitAddon.fit();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      term.dispose();
    };
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    if (!socket) return;
    const onData = (data: string) => {
      socket.send(JSON.stringify({ type: 'data', data }));
    };
    term.onData(onData);
    const onMessage = (e: MessageEvent) => {
      term.write(e.data);
    };
    socket.addEventListener('message', onMessage);
    return () => {
      socket.removeEventListener('message', onMessage);
    };
  }, [socket]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
};
