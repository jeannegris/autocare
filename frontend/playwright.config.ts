import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5000 },
  reporter: 'list',
  use: {
    headless: true,
    // baseURL pode ser sobrescrito via env API_BASE
  }
})
