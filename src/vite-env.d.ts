/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SSH_HOST: string;
    readonly VITE_SSH_USER: string;
    readonly VITE_SSH_PASS: string;
    readonly VITE_SSH_PORT: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
