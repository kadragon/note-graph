import { describe, expect, it } from 'vitest';

import { getTodoRepeatRuleLabel } from './todo-repeat-rule';

describe('getTodoRepeatRuleLabel', () => {
  it('returns korean labels for known repeat rules', () => {
    expect(getTodoRepeatRuleLabel('DAILY')).toBe('매일');
    expect(getTodoRepeatRuleLabel('WEEKLY')).toBe('매주');
    expect(getTodoRepeatRuleLabel('MONTHLY')).toBe('매월');
  });

  it('supports empty fallback for unknown rules', () => {
    expect(getTodoRepeatRuleLabel('CUSTOM', { fallback: 'empty' })).toBe('');
  });

  it('supports raw fallback for unknown rules', () => {
    expect(getTodoRepeatRuleLabel('CUSTOM', { fallback: 'raw' })).toBe('CUSTOM');
  });
});
