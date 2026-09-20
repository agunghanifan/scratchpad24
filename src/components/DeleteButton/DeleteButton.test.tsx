/**
 * Tests for DeleteButton component — Milestone 5
 * Destructive action requires confirmation (Decision 7).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteButton from './DeleteButton';

describe('DeleteButton', () => {
  describe('rendering', () => {
    it('shows "Delete now" button', () => {
      render(<DeleteButton onDelete={vi.fn()} />);
      expect(screen.getByRole('button', { name: /delete now/i })).toBeInTheDocument();
    });

    it('button is visible and enabled by default', () => {
      render(<DeleteButton onDelete={vi.fn()} />);
      const btn = screen.getByRole('button', { name: /delete now/i });
      expect(btn).toBeEnabled();
    });
  });

  describe('confirmation step (Decision 7)', () => {
    it('does NOT call onDelete on first click — requires confirmation', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(<DeleteButton onDelete={onDelete} />);
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /delete now/i }));
      });
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('shows confirmation dialog/modal after first click', async () => {
      const user = userEvent.setup();
      render(<DeleteButton onDelete={vi.fn()} />);
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /delete now/i }));
      });
      
      // Should show a confirmation dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('confirmation dialog has descriptive warning text', async () => {
      const user = userEvent.setup();
      render(<DeleteButton onDelete={vi.fn()} />);
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /delete now/i }));
      });
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent(/delete|confirm|permanent|cannot be undone/i);
    });

    it('calls onDelete only after confirming in dialog', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(<DeleteButton onDelete={onDelete} />);
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /delete now/i }));
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /confirm|yes|delete/i }));
      });
      
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onDelete when user cancels confirmation', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(<DeleteButton onDelete={onDelete} />);
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /delete now/i }));
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /cancel|no/i }));
      });
      
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('no single-click destructive action', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(<DeleteButton onDelete={onDelete} />);
      
      // Multiple rapid clicks should still not delete without confirmation
      const btn = screen.getByRole('button', { name: /delete now/i });
      await act(async () => {
        await user.click(btn);
      });
      await act(async () => {
        await user.click(btn);
      });
      await act(async () => {
        await user.click(btn);
      });
      
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has proper button label', () => {
      render(<DeleteButton onDelete={vi.fn()} />);
      expect(screen.getByRole('button', { name: /delete now/i })).toBeInTheDocument();
    });

    it('confirmation dialog has accessible name', async () => {
      const user = userEvent.setup();
      render(<DeleteButton onDelete={vi.fn()} />);
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /delete now/i }));
      });
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('confirmation dialog has confirm and cancel buttons', async () => {
      const user = userEvent.setup();
      render(<DeleteButton onDelete={vi.fn()} />);
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /delete now/i }));
      });
      
      expect(screen.getByRole('button', { name: /confirm|yes|delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel|no/i })).toBeInTheDocument();
    });

    it('confirmation dialog can be dismissed with Escape key', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(<DeleteButton onDelete={onDelete} />);
      
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /delete now/i }));
      });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      await act(async () => {
        await user.keyboard('{Escape}');
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});
