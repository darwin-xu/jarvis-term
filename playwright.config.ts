import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: 'tests',
    webServer: {
        command: 'npm run client',
        port: 5173,
        reuseExistingServer: true,
    },
});
