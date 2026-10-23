import { defineConfig } from '@playwright/test';

// Usa o Chromium do sistema (sem baixar navegador); em CI, defina PLAYWRIGHT_CHROMIUM_PATH ou instale com `npx playwright install chromium`.
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (process.env.CI ? undefined : '/usr/bin/chromium-browser');

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: { executablePath },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
