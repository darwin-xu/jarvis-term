import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { vi } from 'vitest';

// Mock implementations for testing
export const mockFetch = (response: any, status = 200) => {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: vi.fn().mockResolvedValue(response),
    });
};

export const mockWebSocket = () => {
    const mockWs = {
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        readyState: WebSocket.OPEN,
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
    };

    // @ts-ignore
    global.WebSocket = vi.fn().mockImplementation(() => mockWs);

    return mockWs;
};

export const mockLocalStorage = () => {
    const store: { [key: string]: string } = {};

    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            Object.keys(store).forEach(key => delete store[key]);
        }),
        get store() {
            return { ...store };
        },
    };
};

// Custom render function that includes common providers
const customRender = (ui: ReactElement, options?: RenderOptions) => {
    return render(ui, {
        // Add any providers here if needed
        ...options,
    });
};

export * from '@testing-library/react';
export { customRender as render };
