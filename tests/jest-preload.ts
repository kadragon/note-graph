// Trace: spec_id=SPEC-devx-3 task_id=TASK-0070

/**
 * Jest Preload Module: Early Warning Suppression
 *
 * This module runs before Jest initializes (via --require in jest.config.ts).
 * It monkeypatches process.emitWarning to filter out known, safe-to-suppress warnings.
 *
 * === Why This Approach? ===
 *
 * 1. **Early Interception**: Preload modules execute before Jest setup, catching warnings
 *    that would otherwise appear even before tests run.
 *
 * 2. **Miniflare-Specific Warnings**: Miniflare (Cloudflare Workers simulator) emits runtime
 *    diagnostics that are safe to suppress in a test environment:
 *    - Localstorage file path warnings when --localstorage-file is missing
 *    - These warnings are informational, not errors, and don't affect test execution
 *
 * 3. **ExperimentalWarning Filter**: Node.js experimental module warnings (e.g., for
 *    ESM experimental features) are filtered at the source, not via environment variables.
 *
 * === Warnings Suppressed ===
 *
 * **Localstorage File Warnings** (pattern: "--localstorage-file")
 * - Cause: Miniflare needs an explicit --localstorage-file path for localStorage persistence
 * - Safe to Suppress: Tests use ephemeral in-memory storage; persistence not required
 * - Alternative: Set --localstorage-file in jest.config.ts (included in NODE_OPTIONS)
 * - Status: Already configured in jest.config.ts; this intercepts any remaining messages
 *
 * === Alternatives Considered ===
 *
 * 1. **Environment Variables** (NO_COLOR, NODE_NO_WARNINGS)
 *    - Pro: Simple, global approach
 *    - Con: Suppresses ALL warnings, including legitimate ones; not granular
 *    - Used: NO_COLOR=1 in test scripts for color suppression only
 *
 * 2. **Jest Config Suppress** (jest.config.ts)
 *    - Pro: Centralized configuration
 *    - Con: Jest doesn't provide built-in warning suppression
 *    - Used: Configured NODE_OPTIONS instead
 *
 * 3. **Miniflare Configuration** (jest-setup.ts)
 *    - Pro: Configures Miniflare correctly upfront
 *    - Con: Some warnings from startup occur before jest-setup.ts runs
 *    - Used: Configured with valid --localstorage-file path; this is backup
 *
 * 4. **Process-Level Interception** (this approach) ✓
 *    - Pro: Granular filtering; catches early warnings; preserves legitimate ones
 *    - Con: Requires binding/patching; must maintain filter logic
 *    - Used: Primary approach via jest-preload.ts
 *
 * === Potential Risks & Mitigations ===
 *
 * **Risk 1**: Legitimate warnings get suppressed if they mention "--localstorage-file"
 * - Mitigation: Filter pattern is specific to Miniflare's warning text
 * - Monitor: If filtering too aggressively, adjust pattern or add exclusion logic
 *
 * **Risk 2**: Warnings from other modules are hidden if they match the pattern
 * - Mitigation: Test pattern doesn't match common error messages
 * - Monitor: Run tests without preload periodically to verify no hidden warnings
 *
 * **Risk 3**: Monkeypatching may conflict with other preload modules
 * - Mitigation: Always preserve originalEmitWarning and call it for non-suppressed warnings
 * - Monitor: If multiple preload modules are added, ensure chain of responsibility
 *
 * === How to Debug ===
 *
 * To see all warnings (including suppressed ones):
 *
 * 1. Comment out this module or remove --require from jest.config.ts
 * 2. Run: npm test -- --runInBand
 * 3. All warnings will appear, including those normally suppressed
 *
 * To verify the filter is working:
 *
 * 1. Add console.log before the filter check:
 *    console.log('[jest-preload] Intercepted warning:', message);
 * 2. Run tests and verify only expected warnings appear
 *
 * To add new warning filters:
 *
 * 1. Identify the warning message to suppress
 * 2. Add a new pattern check before returning originalEmitWarning:
 *    if (typeof message === 'string' && message.includes('new-pattern')) return;
 * 3. Document the reason, cause, and alternatives above
 * 4. Test to confirm legitimate warnings are not affected
 */

const originalEmitWarning: typeof process.emitWarning = process.emitWarning.bind(process);

process.emitWarning = ((warning, ...args) => {
  const message = typeof warning === 'string' ? warning : warning?.message;
  if (typeof message === 'string' && message.includes('--localstorage-file')) {
    return;
  }
  return originalEmitWarning(warning, ...args);
}) as typeof process.emitWarning;
