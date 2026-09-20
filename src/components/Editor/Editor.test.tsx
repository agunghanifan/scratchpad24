/**
 * Tests for Editor component — Milestone 5
 * Plain text editor with character/word counter, 100KB cap, debounced save.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Editor from './Editor';

const MAX_BYTES = 100 * 1024;

describe('Editor', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  describe('rendering', () => {
    it('renders a textarea for plain text editing', () => {
      render(<Editor content="" onChange={vi.fn()} onSave={vi.fn()} />);
      const ta = screen.getByRole('textbox', { name: /note content/i });
      expect(ta).toBeInTheDocument();
      expect(ta.tagName).toBe('TEXTAREA');
    });

    it('displays current content in the textarea', () => {
      render(<Editor content="Hello world" onChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByRole('textbox', { name: /note content/i })).toHaveValue('Hello world');
    });

    it('renders as plain text only — NO markdown rendering', () => {
      const md = '# Heading\n**bold**\n- list\n[link](http://example.com)';
      render(<Editor content={md} onChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByRole('textbox', { name: /note content/i })).toHaveValue(md);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('does NOT use dangerouslySetInnerHTML', () => {
      const { container } = render(
        <Editor content="<script>alert(1)</script>" onChange={vi.fn()} onSave={vi.fn()} />
      );
      const ta = screen.getByRole('textbox', { name: /note content/i });
      expect(ta).toHaveValue("<script>alert(1)</script>");
      container.querySelectorAll('*').forEach((el) => {
        expect(el.getAttribute('dangerouslySetInnerHTML')).toBeNull();
      });
    });
  });

  describe('character and word counter', () => {
    it('displays live character count', () => {
      render(<Editor content="Hello" onChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByText(/5 characters/i)).toBeInTheDocument();
    });

    it('displays live word count', () => {
      render(<Editor content="Hello world foo" onChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByText(/3 words/i)).toBeInTheDocument();
    });
  describe('100KB payload cap', () => {
    it('shows inline error when content exceeds 100KB', () => {
      render(<Editor content={'a'.repeat(MAX_BYTES + 1)} onChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByText(/exceeds maximum size/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('does not show error when content is exactly 100KB', () => {
      render(<Editor content={'a'.repeat(MAX_BYTES)} onChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.queryByText(/exceeds maximum size/i)).not.toBeInTheDocument();
    });

    it('does not show error when content is under 100KB', () => {
      render(<Editor content={'a'.repeat(1000)} onChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.queryByText(/exceeds maximum size/i)).not.toBeInTheDocument();
    });

    it('stops accepting input at 100KB cap', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onChange = vi.fn();
      render(<Editor content={'a'.repeat(MAX_BYTES)} onChange={onChange} onSave={vi.fn()} />);
      await user.type(screen.getByRole('textbox', { name: /note content/i }), 'b');
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      if (lastCall) {
        expect(new TextEncoder().encode(lastCall[0]).length).toBeLessThanOrEqual(MAX_BYTES);
      }
    });

    it('does not call onSave when content exceeds 100KB', () => {
      const onSave = vi.fn();
      render(<Editor content={'a'.repeat(MAX_BYTES + 1)} onChange={vi.fn()} onSave={onSave} />);
      vi.advanceTimersByTime(1000);
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('debounced save', () => {
    it('calls onSave with debounced updates (~800ms)', () => {
      const onSave = vi.fn();
      render(<Editor content="initial" onChange={vi.fn()} onSave={onSave} />);
      expect(onSave).not.toHaveBeenCalled();
      vi.advanceTimersByTime(500);
      expect(onSave).not.toHaveBeenCalled();
      vi.advanceTimersByTime(400);
      expect(onSave).toHaveBeenCalledWith('initial');
    });

    it('resets debounce timer on each change', () => {
      const onSave = vi.fn();
      const onChange = vi.fn();
      const { rerender } = render(<Editor content="a" onChange={onChange} onSave={onSave} />);
      vi.advanceTimersByTime(400);
      rerender(<Editor content="ab" onChange={onChange} onSave={onSave} />);
      vi.advanceTimersByTime(400);
      rerender(<Editor content="abc" onChange={onChange} onSave={onSave} />);
      expect(onSave).not.toHaveBeenCalled();
      vi.advanceTimersByTime(800);
      expect(onSave).toHaveBeenCalledWith('abc');
    });

    it('calls onSave with the latest content', () => {
      const onSave = vi.fn();
      const onChange = vi.fn();
      const { rerender } = render(<Editor content="first" onChange={onChange} onSave={onSave} />);
      vi.advanceTimersByTime(400);
      rerender(<Editor content="second" onChange={onChange} onSave={onSave} />);
      vi.advanceTimersByTime(800);
      expect(onSave).toHaveBeenCalledWith('second');
    });
  });

  describe('onChange callback', () => {
    it('calls onChange when user types', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onChange = vi.fn();
      render(<Editor content="" onChange={onChange} onSave={vi.fn()} />);
      await user.type(screen.getByRole('textbox', { name: /note content/i }), 'Hello');
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has proper label for textarea', () => {
      render(<Editor content="" onChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByRole('textbox', { name: /note content/i })).toBeInTheDocument();
    });

    it('has ARIA live region for character count', () => {
      render(<Editor content="test" onChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByText(/4 characters/i)).toHaveAttribute('aria-live');
    });

    it('error message has role="alert" for screen readers', () => {
      render(<Editor content={'a'.repeat(MAX_BYTES + 1)} onChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});


    it('updates counter as user types', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onChange = vi.fn();
      render(<Editor content="" onChange={onChange} onSave={vi.fn()} />);
      await user.type(screen.getByRole('textbox', { name: /note content/i }), 'Hi');
      expect(screen.getByText(/2 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/1 word/i)).toBeInTheDocument();
    });

    it('shows 0 characters and 0 words for empty content', () => {
      render(<Editor content="" onChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByText(/0 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/0 words/i)).toBeInTheDocument();
    });
  });
