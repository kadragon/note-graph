import { useCallback, useEffect, useRef, useState } from 'react';

export interface ProgressStep {
  label: string;
  durationMs: number; // 0 = last step (wait indefinitely)
}

interface UseStepProgressOptions {
  steps: ProgressStep[];
  isActive: boolean;
}

export function useStepProgress({ steps, isActive }: UseStepProgressOptions) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      clearTimer();
      setCurrentStepIndex(0);
      return;
    }

    if (currentStepIndex >= steps.length) {
      setCurrentStepIndex(0);
      return;
    }

    const step = steps[currentStepIndex];
    if (step.durationMs === 0) return;

    timerRef.current = setTimeout(() => {
      setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }, step.durationMs);

    return clearTimer;
  }, [isActive, currentStepIndex, steps, clearTimer]);

  return {
    currentStepIndex,
    steps,
    isActive,
    isLastStep: currentStepIndex === steps.length - 1,
  };
}
