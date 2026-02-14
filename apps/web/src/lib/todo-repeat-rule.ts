import type { RepeatRule } from '@web/types/api';

export const TODO_REPEAT_RULE_LABELS: Partial<Record<RepeatRule, string>> = {
  DAILY: '매일',
  WEEKLY: '매주',
  MONTHLY: '매월',
};

interface GetTodoRepeatRuleLabelOptions {
  fallback?: 'empty' | 'raw';
}

export function getTodoRepeatRuleLabel(
  repeatRule: string,
  options: GetTodoRepeatRuleLabelOptions = {}
): string {
  const fallback = options.fallback ?? 'raw';
  const label = TODO_REPEAT_RULE_LABELS[repeatRule as RepeatRule];

  if (label) {
    return label;
  }

  return fallback === 'empty' ? '' : repeatRule;
}
