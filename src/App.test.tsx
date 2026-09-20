/**
 * Tests for App component — routing configuration
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Mock pages
vi.mock('./pages/HomePage', () => ({
  default: () => <div data-testid="home-page">Home Page</div>,
}));

vi.mock('./pages/NotePage', () => ({
  default: () => <div data-testid="note-page">Note Page</div>,
}));

vi.mock('./pages/PrivacyPage', () => ({
  default: () => <div data-testid="privacy-page">Privacy Page</div>,
}));

describe('App', () => {
  it('renders HomePage at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });

  it('renders NotePage at /n/:noteId', () => {
    render(
      <MemoryRouter initialEntries={['/n/test123']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId('note-page')).toBeInTheDocument();
  });

  it('renders PrivacyPage at /privacy', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId('privacy-page')).toBeInTheDocument();
  });
});
