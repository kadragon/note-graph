import { vi } from 'vitest';

export const PersonImportDialog = vi.fn(
  ({
    open,
    onOpenChange,
    onPersonImported,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPersonImported?: (personId: string) => void;
  }) =>
    open ? (
      <div data-testid="person-import-dialog">
        <button type="button" onClick={() => onPersonImported?.('new-person-id')}>
          Import Person
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close Dialog
        </button>
      </div>
    ) : null
);
