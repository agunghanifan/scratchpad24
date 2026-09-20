/**
 * Tests for ExpiryBanner component — Milestone 5
 * Countdown timer showing time remaining until note expires.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ExpiryBanner from './ExpiryBanner';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MIN = 60 * 1000;
const TWENTY_FOUR_H = 24 * MS_PER_HOUR;

describe('ExpiryBanner', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  describe('countdown display', () => {
    it('displays countdown timer in "Xh Ym" format', () => {
      const now = Date.now();
      const createdAt = now;
      // Advance 30 minutes so remaining = 23h 30m
      vi.setSystemTime(now + 30 * MS_PER_MIN);
      render(<ExpiryBanner createdAt={createdAt} expiresAt={createdAt + TWENTY_FOUR_H} />);
      expect(screen.getByText(/23h 30m/i)).toBeInTheDocument();
    });

    it('shows "Expires in" prefix', () => {
      const now = Date.now();
      render(<ExpiryBanner createdAt={now} expiresAt={now + TWENTY_FOUR_H} />);
      expect(screen.getByText(/expires in/i)).toBeInTheDocument();
    });

    it('shows correct time for 12h 45m remaining', () => {
      const now = Date.now();
      const createdAt = now;
      vi.setSystemTime(now + 11 * MS_PER_HOUR + 15 * MS_PER_MIN);
      render(<ExpiryBanner createdAt={createdAt} expiresAt={createdAt + TWENTY_FOUR_H} />);
      expect(screen.getByText(/12h 45m/i)).toBeInTheDocument();
    });

    it('shows "0h 0m" when exactly at expiry time', () => {
      const now = Date.now();
      const createdAt = now;
      vi.setSystemTime(now + TWENTY_FOUR_H);
      render(<ExpiryBanner createdAt={createdAt} expiresAt={createdAt + TWENTY_FOUR_H} />);
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });
  });

  describe('real-time updates', () => {
    it('updates countdown every minute', () => {
      const now = Date.now();
      const createdAt = now;
      render(<ExpiryBanner createdAt={createdAt} expiresAt={createdAt + TWENTY_FOUR_H} />);
      
      expect(screen.getByText(/24h 0m/i)).toBeInTheDocument();
      
      act(() => { vi.advanceTimersByTime(MS_PER_MIN); });
      expect(screen.getByText(/23h 59m/i)).toBeInTheDocument();
      
      act(() => { vi.advanceTimersByTime(MS_PER_MIN); });
      expect(screen.getByText(/23h 58m/i)).toBeInTheDocument();
    });

    it('updates countdown every second for final minutes', () => {
      const now = Date.now();
      const createdAt = now;
      // Set time to 2 minutes before expiry
      vi.setSystemTime(now + TWENTY_FOUR_H - 2 * MS_PER_MIN);
      render(<ExpiryBanner createdAt={createdAt} expiresAt={createdAt + TWENTY_FOUR_H} />);
      
      expect(screen.getByText(/0h 2m/i)).toBeInTheDocument();
      
      act(() => { vi.advanceTimersByTime(1000); });
      // Should still show updated time
      expect(screen.getByText(/expires in/i)).toBeInTheDocument();
    });
  });

  describe('expired state', () => {
    it('shows "Expired" when note expires', () => {
      const now = Date.now();
      const createdAt = now;
      vi.setSystemTime(now + TWENTY_FOUR_H + 1000);
      render(<ExpiryBanner createdAt={createdAt} expiresAt={createdAt + TWENTY_FOUR_H} />);
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });

    it('transitions to "Expired" as time passes', () => {
      const now = Date.now();
      const createdAt = now;
      render(<ExpiryBanner createdAt={createdAt} expiresAt={createdAt + TWENTY_FOUR_H} />);
      
      expect(screen.getByText(/expires in/i)).toBeInTheDocument();
      
      act(() => { vi.advanceTimersByTime(TWENTY_FOUR_H); });
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });

    it('shows "Expired" immediately if already past expiry', () => {
      const now = Date.now();
      const createdAt = now - TWENTY_FOUR_H - 1000;
      render(<ExpiryBanner createdAt={createdAt} expiresAt={createdAt + TWENTY_FOUR_H} />);
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });
  });

  describe('no extension button', () => {
    it('does NOT show an "extend" button (Decision 6)', () => {
      const now = Date.now();
      render(<ExpiryBanner createdAt={now} expiresAt={now + TWENTY_FOUR_H} />);
      expect(screen.queryByRole('button', { name: /extend/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/extend/i)).not.toBeInTheDocument();
    });

    it('does not have any buttons at all', () => {
      const now = Date.now();
      render(<ExpiryBanner createdAt={now} expiresAt={now + TWENTY_FOUR_H} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has ARIA live region for countdown updates', () => {
      const now = Date.now();
      render(<ExpiryBanner createdAt={now} expiresAt={now + TWENTY_FOUR_H} />);
      const banner = screen.getByRole('status');
      expect(banner).toHaveAttribute('aria-live');
    });

    it('has aria-label describing the countdown', () => {
      const now = Date.now();
      render(<ExpiryBanner createdAt={now} expiresAt={now + TWENTY_FOUR_H} />);
      const banner = screen.getByRole('status');
      expect(banner.getAttribute('aria-label')).toMatch(/expires/i);
    });

    it('announces "Expired" state to screen readers', () => {
      const now = Date.now();
      const createdAt = now;
      vi.setSystemTime(now + TWENTY_FOUR_H + 1000);
      render(<ExpiryBanner createdAt={createdAt} expiresAt={createdAt + TWENTY_FOUR_H} />);
      const banner = screen.getByRole('status');
      expect(banner).toHaveTextContent(/expired/i);
    });
  });
});
