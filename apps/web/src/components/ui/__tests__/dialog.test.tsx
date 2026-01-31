import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../dialog';

function TestDialog({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button type="button">Open Dialog</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test Dialog</DialogTitle>
          <DialogDescription>This is a test dialog</DialogDescription>
        </DialogHeader>
        <input type="text" placeholder="First input" />
        <input type="text" placeholder="Second input" />
        <button type="button">Action Button</button>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog keyboard navigation', () => {
  it('has accessible close button with sr-only text', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);

    await user.click(screen.getByText('Open Dialog'));

    const closeButton = screen.getByRole('button', { name: /닫기/ });
    expect(closeButton).toBeInTheDocument();
  });

  it('closes when clicking the close button', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<TestDialog onOpenChange={onOpenChange} />);

    await user.click(screen.getByText('Open Dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /닫기/ });
    await user.click(closeButton);

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('closes on Escape key press', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<TestDialog onOpenChange={onOpenChange} />);

    await user.click(screen.getByText('Open Dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('has focus trapped within dialog', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);

    await user.click(screen.getByText('Open Dialog'));

    const firstInput = screen.getByPlaceholderText('First input');
    const secondInput = screen.getByPlaceholderText('Second input');
    const actionButton = screen.getByRole('button', { name: 'Action Button' });
    const closeButton = screen.getByRole('button', { name: /닫기/ });

    // Focus starts on close button (Radix default)
    // Tab cycles through focusable elements within the dialog
    await user.tab();
    expect(document.activeElement).toBe(secondInput);

    await user.tab();
    expect(document.activeElement).toBe(actionButton);

    await user.tab();
    expect(document.activeElement).toBe(closeButton);

    // Tab wraps back to first focusable element (focus trap)
    await user.tab();
    expect(document.activeElement).toBe(firstInput);
  });
});
