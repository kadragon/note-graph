// Trace: spec_id=SPEC-devx-3 task_id=TASK-0070

const originalEmitWarning: typeof process.emitWarning = process.emitWarning.bind(process);

process.emitWarning = ((warning, ...args) => {
  const message = typeof warning === 'string' ? warning : warning?.message;
  if (typeof message === 'string' && message.includes('--localstorage-file')) {
    return;
  }
  return originalEmitWarning(warning, ...args);
}) as typeof process.emitWarning;
