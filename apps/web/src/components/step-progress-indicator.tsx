import type { ProgressStep } from '@web/hooks/use-step-progress';
import { Check, Circle, Loader2 } from 'lucide-react';

interface StepProgressIndicatorProps {
  steps: ProgressStep[];
  currentStepIndex: number;
}

export function StepProgressIndicator({ steps, currentStepIndex }: StepProgressIndicatorProps) {
  return (
    <div className="space-y-2 py-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;

        return (
          <div key={step.label} className="flex items-center gap-2 transition-all duration-300">
            {isCompleted ? (
              <Check className="h-4 w-4 text-green-500 shrink-0" />
            ) : isCurrent ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            )}
            <span
              className={
                isCompleted
                  ? 'text-sm text-muted-foreground'
                  : isCurrent
                    ? 'text-sm font-medium'
                    : 'text-sm text-muted-foreground/40'
              }
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
