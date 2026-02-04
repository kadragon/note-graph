import { existsSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('sidebar removal', () => {
  it('removes sidebar collapse plumbing files', () => {
    const root = process.cwd();
    expect(existsSync(path.join(root, 'apps/web/src/components/layout/sidebar.tsx'))).toBe(false);
    expect(existsSync(path.join(root, 'apps/web/src/contexts/sidebar-context.tsx'))).toBe(false);
    expect(existsSync(path.join(root, 'apps/web/src/hooks/use-sidebar-collapse.ts'))).toBe(false);
  });
});
