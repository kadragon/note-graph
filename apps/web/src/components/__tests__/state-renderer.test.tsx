import { render, screen } from '@web/test/setup';
import { describe, expect, it } from 'vitest';

import { StateRenderer } from '../state-renderer';

describe('StateRenderer', () => {
  it('renders loading spinner when isLoading is true', () => {
    render(
      <StateRenderer isLoading={true} isEmpty={false}>
        <div>Content</div>
      </StateRenderer>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders empty message when isEmpty is true', () => {
    render(
      <StateRenderer isLoading={false} isEmpty={true} emptyMessage="데이터가 없습니다.">
        <div>Content</div>
      </StateRenderer>
    );

    expect(screen.getByText('데이터가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders children when not loading and not empty', () => {
    render(
      <StateRenderer isLoading={false} isEmpty={false}>
        <div>Content</div>
      </StateRenderer>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });

  it('uses default empty message when not provided', () => {
    render(
      <StateRenderer isLoading={false} isEmpty={true}>
        <div>Content</div>
      </StateRenderer>
    );

    expect(screen.getByText('데이터가 없습니다.')).toBeInTheDocument();
  });

  it('prioritizes loading state over empty state', () => {
    render(
      <StateRenderer isLoading={true} isEmpty={true} emptyMessage="Empty">
        <div>Content</div>
      </StateRenderer>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByText('Empty')).not.toBeInTheDocument();
  });

  it('renders error message when error is provided', () => {
    const error = new Error('Something went wrong');
    render(
      <StateRenderer isLoading={false} isEmpty={false} error={error}>
        <div>Content</div>
      </StateRenderer>
    );

    expect(screen.getByText('오류가 발생했습니다.')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('uses custom error message when provided', () => {
    const error = new Error('Network error');
    render(
      <StateRenderer
        isLoading={false}
        isEmpty={false}
        error={error}
        errorMessage="데이터를 불러올 수 없습니다."
      >
        <div>Content</div>
      </StateRenderer>
    );

    expect(screen.getByText('데이터를 불러올 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('prioritizes loading over error state', () => {
    const error = new Error('Error');
    render(
      <StateRenderer isLoading={true} isEmpty={false} error={error}>
        <div>Content</div>
      </StateRenderer>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByText('오류가 발생했습니다.')).not.toBeInTheDocument();
  });

  it('prioritizes error over empty state', () => {
    const error = new Error('Error message');
    render(
      <StateRenderer isLoading={false} isEmpty={true} error={error}>
        <div>Content</div>
      </StateRenderer>
    );

    expect(screen.getByText('오류가 발생했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('데이터가 없습니다.')).not.toBeInTheDocument();
  });
});
