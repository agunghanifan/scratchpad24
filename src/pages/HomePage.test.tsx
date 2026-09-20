/**
 * Tests for HomePage — Milestone 5
 * Landing page with "Start a new pad" button.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './HomePage';

// Mock API client
const mockCreateNote = vi.fn();
vi.mock('../api/client', () => ({
  createNote: (...args: unknown[]) => mockCreateNote(...args),
}));

// Mock router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNote.mockResolvedValue({
      noteId: 'new-note-id',
      deleteToken: 'test-delete-token',
    });
    // Mock localStorage
    const store: Record<string, string> = {};
    Storage.prototype.setItem = vi.fn((key: string, val: string) => { store[key] = val; });
    Storage.prototype.getItem = vi.fn((key: string) => store[key] ?? null);
  });

  describe('rendering', () => {
    it('renders "Start a new pad" button', () => {
      render(<HomePage />);
      expect(screen.getByRole('button', { name: /start a new pad/i })).toBeInTheDocument();
    });

    it('button is enabled by default', () => {
      render(<HomePage />);
      expect(screen.getByRole('button', { name: /start a new pad/i })).toBeEnabled();
    });

    it('shows app title/description', () => {
      render(<HomePage />);
      expect(screen.getByText(/scratchpad24|distraction.free|24.hour/i)).toBeInTheDocument();
    });
  });

  describe('creating a new note', () => {
    it('calls API to create note on button click', async () => {
      const user = userEvent.setup();
      render(<HomePage />);
      
      await user.click(screen.getByRole('button', { name: /start a new pad/i }));
      
      await waitFor(() => {
        expect(mockCreateNote).toHaveBeenCalledWith('');
      });
    });

    it('redirects to /n/{noteId} after creation', async () => {
      const user = userEvent.setup();
      render(<HomePage />);
      
      await user.click(screen.getByRole('button', { name: /start a new pad/i }));
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/n/new-note-id');
      });
    });

    it('stores deleteToken in localStorage', async () => {
      const user = userEvent.setup();
      render(<HomePage />);
      
      await user.click(screen.getByRole('button', { name: /start a new pad/i }));
      
      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'deleteToken:new-note-id',
          'test-delete-token'
        );
      });
    });

    it('shows loading state while creating note', async () => {
      const user = userEvent.setup();
      mockCreateNote.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<HomePage />);
      await user.click(screen.getByRole('button', { name: /start a new pad/i }));
      
      expect(screen.getByText(/creating|loading/i)).toBeInTheDocument();
    });

    it('disables button while creating note', async () => {
      const user = userEvent.setup();
      mockCreateNote.mockImplementation(() => new Promise(() => {}));
      
      render(<HomePage />);
      await user.click(screen.getByRole('button', { name: /start a new pad/i }));
      
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('error handling', () => {
    it('shows error message when creation fails', async () => {
      const user = userEvent.setup();
      mockCreateNote.mockRejectedValue(new Error('Network error'));
      
      render(<HomePage />);
      await user.click(screen.getByRole('button', { name: /start a new pad/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
      });
    });

    it('shows fallback error message for non-Error rejection', async () => {
      const user = userEvent.setup();
      mockCreateNote.mockRejectedValue('string error');
      
      render(<HomePage />);
      await user.click(screen.getByRole('button', { name: /start a new pad/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/failed to create note/i)).toBeInTheDocument();
      });
    });

    it('re-enables button after error', async () => {
      const user = userEvent.setup();
      mockCreateNote.mockRejectedValue(new Error('Failed'));
      
      render(<HomePage />);
      await user.click(screen.getByRole('button', { name: /start a new pad/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start a new pad/i })).toBeEnabled();
      });
    });
  });

  describe('security', () => {
    it('no PII collection or tracking', () => {
      render(<HomePage />);
      const scripts = document.querySelectorAll('script');
      scripts.forEach((script) => {
        expect(script.textContent).not.toMatch(/analytics|tracking|gtag|ga\(/i);
      });
    });

    it('no account/login/signup UI', () => {
      render(<HomePage />);
      expect(screen.queryByText(/sign up|log in|register|account/i)).not.toBeInTheDocument();
    });
  });
});
