/**
 * Tests for PrivacyPage - Milestone 8
 * Static privacy and terms page.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPage from './PrivacyPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithRouter(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PrivacyPage />
    </MemoryRouter>
  );
}

describe('PrivacyPage', () => {
  describe('rendering', () => {
    it('renders the page title', () => {
      renderWithRouter();
      expect(screen.getByRole('heading', { level: 1, name: /privacy & terms/i })).toBeInTheDocument();
    });

    it('renders all required sections', () => {
      renderWithRouter();
      
      expect(screen.getByRole('heading', { level: 2, name: /no accounts/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /no pii collection/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /ephemeral storage/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /accepted risk/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /no content moderation/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /disclaimer/i })).toBeInTheDocument();
    });

    it('renders a back button', () => {
      renderWithRouter();
      const backBtn = screen.getByRole('button', { name: /back/i });
      expect(backBtn).toBeInTheDocument();
    });

    it('back button navigates to previous page', () => {
      renderWithRouter();
      mockNavigate.mockClear();
      const backBtn = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backBtn);
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('content', () => {
    it('explains no account/login/session requirement', () => {
      renderWithRouter();
      expect(screen.getByText(/no account.*no login.*no session/i)).toBeInTheDocument();
    });

    it('explains no PII collection', () => {
      renderWithRouter();
      expect(screen.getByText(/do not collect.*personally identifiable information/i)).toBeInTheDocument();
    });

    it('explains 24-hour ephemeral storage', () => {
      renderWithRouter();
      expect(screen.getByText(/permanently deleted.*24 hours/i)).toBeInTheDocument();
    });

    it('explains URL is the only credential', () => {
      renderWithRouter();
      expect(screen.getByText(/anyone with the exact link/i)).toBeInTheDocument();
      expect(screen.getByText(/URL is the only credential/i)).toBeInTheDocument();
    });

    it('explains no content moderation', () => {
      renderWithRouter();
      expect(screen.getByText(/anonymous and ephemeral.*no content moderation/i)).toBeInTheDocument();
    });

    it('includes disclaimer about MVP placeholder language', () => {
      renderWithRouter();
      expect(screen.getByText(/placeholder language.*MVP/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('uses semantic HTML with proper heading hierarchy', () => {
      renderWithRouter();
      
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
      
      const h2s = screen.getAllByRole('heading', { level: 2 });
      expect(h2s.length).toBeGreaterThan(0);
    });

    it('uses article element for main content', () => {
      renderWithRouter();
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('uses section elements for content sections', () => {
      const { container } = renderWithRouter();
      const sections = container.querySelectorAll('section');
      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe('security', () => {
    it('no PII collection or tracking', () => {
      renderWithRouter();
      const scripts = document.querySelectorAll('script');
      scripts.forEach((script) => {
        expect(script.textContent).not.toMatch(/analytics|tracking|gtag|ga\(/i);
      });
    });

    it('no external links — only internal navigation', () => {
      renderWithRouter();
      const links = screen.queryAllByRole('link');
      expect(links.length).toBe(0);
    });
  });
});
