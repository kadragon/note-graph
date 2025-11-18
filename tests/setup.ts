// Trace: TASK-016
// Test setup and global configuration

import { beforeAll } from 'vitest';

beforeAll(async () => {
  // Test environment is set up by @cloudflare/vitest-pool-workers
  // Bindings are available via env parameter
  console.log('[Test Setup] Cloudflare Workers test environment initialized');
});
