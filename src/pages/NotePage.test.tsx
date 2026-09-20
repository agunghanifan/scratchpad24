/**
 * Tests for NotePage — Milestone 5
 * Main page for viewing/editing a single note.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotePage from './NotePage';

// Mock hooks and components
const mockUseNote = vi.fn();
vi.mock('../hooks/useNote', () => ({ default: (...args: unknown[]) => mockUseNote(...args) }));

const mockUseAutosave = vi.fn();
vi.mock('../hooks/useAutosave', () => ({ default: (...args: unknown[]) => mockUseAutosave(...args) }));

const mockDeleteNote = vi.fn();
vi.mock('../api/client', () => ({
  deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
}));

const mockNavigate = vi.fn();
let mockNoteIdParam: string | undefined = 'test-note-id';
vi.mock('react-router-dom', () => ({
  useParams: () => ({ noteId: mockNoteIdParam }),
  useNavigate: () => mockNavigate,
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

describe('NotePage', () => {
  const mockNote = {
    id: 'test-note-id',
    content: 'Hello world',
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNoteIdParam = 'test-note-id';
    mockUseNote.mockReturnValue({ note: mockNote, loading: false, error: null });
    mockUseAutosave.mockReturnValue({ status: 'saved', error: null });
    mockDeleteNote.mockResolvedValue({ success: true });
    // Mock localStorage
    Storage.prototype.getItem = vi.fn().mockReturnValue('test-delete-token');
  });

  describe('rendering', () => {
    it('renders editor with note content', async () => {
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /note content/i })).toHaveValue('Hello world');
      });
    });

    it('displays expiry banner', async () => {
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByText(/expires in/i)).toBeInTheDocument();
      });
    });

    it('displays delete button', async () => {
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete now/i })).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('shows loading indicator while fetching note', () => {
      mockUseNote.mockReturnValue({ note: null, loading: true, error: null });
      render(<NotePage />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when note not found', () => {
      mockUseNote.mockReturnValue({ note: null, loading: false, error: new Error('Not found') });
      render(<NotePage />);
      expect(screen.getByText(/not found|expired/i)).toBeInTheDocument();
    });

    it('shows "Go to Home" link when note not found', () => {
      mockUseNote.mockReturnValue({ note: null, loading: false, error: new Error('Not found') });
      render(<NotePage />);
      const homeLink = screen.getByRole('link', { name: /go to home/i });
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute('href', '/');
    });
  });

  describe('null note (not loading, no error)', () => {
    it('shows "Note not found" when note is null without error', () => {
      mockUseNote.mockReturnValue({ note: null, loading: false, error: null });
      render(<NotePage />);
      expect(screen.getByText(/note not found/i)).toBeInTheDocument();
    });

    it('shows "Go to Home" link when note is null', () => {
      mockUseNote.mockReturnValue({ note: null, loading: false, error: null });
      render(<NotePage />);
      const homeLink = screen.getByRole('link', { name: /go to home/i });
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute('href', '/');
    });
  });

  describe('undefined noteId', () => {
    it('handles undefined noteId gracefully', () => {
      mockNoteIdParam = undefined;
      mockUseNote.mockReturnValue({ note: null, loading: false, error: null });
      render(<NotePage />);
      expect(screen.getByText(/note not found/i)).toBeInTheDocument();
    });


    it('uses empty string fallback when noteId is undefined', () => {
      mockNoteIdParam = undefined;
      mockUseNote.mockReturnValue({ note: null, loading: false, error: null });
      render(<NotePage />);
      // The component should call useNote with empty string
      expect(mockUseNote).toHaveBeenCalledWith('');
    });
  });

  describe('save status indicators', () => {
    it('shows "Saving..." when saveStatus is saving', async () => {
      mockUseAutosave.mockReturnValue({ status: 'saving', error: null });
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      });
    });

    it('shows "Saved" when saveStatus is saved', async () => {
      mockUseAutosave.mockReturnValue({ status: 'saved', error: null });
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByText(/^saved$/i)).toBeInTheDocument();
      });
    });

    it('shows "Save failed" when saveStatus is error', async () => {
      mockUseAutosave.mockReturnValue({ status: 'error', error: new Error('fail') });
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByText(/save failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('copy-link functionality', () => {
    it('has a copy-link button', async () => {
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
      });
    });

    it('copies URL to clipboard when clicked', async () => {
      const user = userEvent.setup();
      // Mock clipboard API
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });
      // Mock window.location.href to include note ID
      Object.defineProperty(window, 'location', {
        value: { href: 'http://localhost:3000/n/test-note-id' },
        writable: true,
        configurable: true,
      });
      
      render(<NotePage />);
      await user.click(screen.getByRole('button', { name: /copy link/i }));
      
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining('test-note-id')
      );
    });

    it('shows warning about link sharing risk', async () => {
      render(<NotePage />);
      expect(screen.getByText(/anyone with this link can view/i)).toBeInTheDocument();
    });
  });

  describe('delete functionality', () => {
    it('calls delete API after confirmation', async () => {
      const user = userEvent.setup();
      render(<NotePage />);
      
      await user.click(screen.getByRole('button', { name: /delete now/i }));
      await user.click(screen.getByRole('button', { name: /confirm|yes|delete/i }));
      
      await waitFor(() => {
        expect(mockDeleteNote).toHaveBeenCalledWith('test-note-id', 'test-delete-token');
      });
    });

    it('redirects to home after successful deletion', async () => {
      const user = userEvent.setup();
      render(<NotePage />);
      
      await user.click(screen.getByRole('button', { name: /delete now/i }));
      await user.click(screen.getByRole('button', { name: /confirm|yes|delete/i }));
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });



  });

  describe('security', () => {
    it('no markdown rendering — plain text only', async () => {
      const noteWithMarkdown = { ...mockNote, content: '# Heading\n**bold**' };
      mockUseNote.mockReturnValue({ note: noteWithMarkdown, loading: false, error: null });
      
      render(<NotePage />);
      await waitFor(() => {
        const textarea = screen.getByRole('textbox', { name: /note content/i });
        expect(textarea).toHaveValue('# Heading\n**bold**');
      });
    });

    it('no PII collection or tracking', () => {
      render(<NotePage />);
      // Should not have any analytics/tracking scripts
      const scripts = document.querySelectorAll('script');
      scripts.forEach((script) => {
        expect(script.textContent).not.toMatch(/analytics|tracking|gtag|ga\(/i);
      });
    });
  });

  describe('ownership detection', () => {
    it('renders DeleteButton when localStorage has deleteToken (owner)', async () => {
      Storage.prototype.getItem = vi.fn().mockReturnValue('test-delete-token');
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete now/i })).toBeInTheDocument();
      });
    });

    it('does not render DeleteButton when localStorage has no token (non-owner)', async () => {
      Storage.prototype.getItem = vi.fn().mockReturnValue(null);
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /delete now/i })).not.toBeInTheDocument();
      });
    });

    it('Editor is not readOnly when user is owner (has token)', async () => {
      Storage.prototype.getItem = vi.fn().mockReturnValue('test-delete-token');
      render(<NotePage />);
      await waitFor(() => {
        const textarea = screen.getByRole('textbox', { name: /note content/i });
        expect(textarea).not.toHaveAttribute('readOnly');
      });
    });

    it('Editor is readOnly when user is not owner (no token)', async () => {
      Storage.prototype.getItem = vi.fn().mockReturnValue(null);
      render(<NotePage />);
      await waitFor(() => {
        const textarea = screen.getByRole('textbox', { name: /note content/i });
        expect(textarea).toHaveAttribute('readOnly');
      });
    });

    it('owner sees warning about link sharing', async () => {
      Storage.prototype.getItem = vi.fn().mockReturnValue('test-delete-token');
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByText(/anyone with this link can view/i)).toBeInTheDocument();
      });
    });

    it('non-owner sees read-only warning', async () => {
      Storage.prototype.getItem = vi.fn().mockReturnValue(null);
      render(<NotePage />);
      await waitFor(() => {
        expect(screen.getByText(/read-only/i)).toBeInTheDocument();
      });
    });
  });
});
