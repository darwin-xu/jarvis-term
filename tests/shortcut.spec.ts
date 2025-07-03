import { test, expect } from '@playwright/test';
import path from 'path';

const file = path.join(__dirname, '..', 'dist', 'index.html');
const url = 'file://' + file;

test('Ctrl+I toggles AI assistant', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('.ai-assistant-pane.open')).toHaveCount(0);
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+i`);
    await expect(page.locator('.ai-assistant-pane.open')).toHaveCount(1);
});
