import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from '../src/App';
import * as client from '../src/api/client';
import type { SearchResponse, StatusResponse } from '../src/types';

const MOCK_STATUS: StatusResponse = {
  mode: 'live',
  interpretMode: 'live',
  gemini: { configured: true, valid: true },
  spotify: { configured: true, valid: true, authorized: true },
  missing: [],
};

const MOCK_SEARCH_RESPONSE: SearchResponse = {
  mode: 'live',
  intent: {
    mood: 'peaceful',
    activity: 'studying',
    energy: 'low',
    tempo: 'slow',
    genre: ['piano', 'ambient'],
    vocals: 'instrumental_preferred',
    time_context: 'late_night',
    breakdown: {
      mood: { value: 'peaceful', source: 'explicit', priority: 'high' },
      activity: { value: 'studying', source: 'explicit', priority: 'high' },
      energy: { value: 'low', source: 'inferred', priority: 'low' },
      tempo: { value: 'slow', source: 'inferred', priority: 'low' },
      genre: { value: ['piano', 'ambient'], source: 'explicit', priority: 'medium_high' },
      vocals: { value: 'instrumental_preferred', source: 'explicit', priority: 'medium_high' },
      time_context: { value: 'late_night', source: 'explicit', priority: 'medium' },
    },
  },
  queries: {
    primary: 'peaceful study instrumental piano ambient',
    alternatives: ['late night focus instrumental'],
  },
  tracks: [
    {
      id: 'track-1',
      name: 'Peaceful Mind',
      artists: ['Ambient Artist'],
      album: 'Midnight Thoughts',
      albumArtUrl: 'https://example.com/art.jpg',
      durationMs: 180000,
      spotifyUrl: 'https://open.spotify.com/track/track-1',
      previewUrl: null,
    },
  ],
};

describe('ECHORA App UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(client, 'getStatus').mockResolvedValue(MOCK_STATUS);
  });

  it('renders top bar brand and hero section', async () => {
    render(<App />);

    // Brand logo
    expect(screen.getByLabelText('ECHORA logo')).toBeInTheDocument();

    // Headline
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Tell me how you feel/i);
    expect(screen.getByText(/Describe your mood, moment, or setting/i)).toBeInTheDocument();

    // Discover button is disabled initially
    const discoverBtn = screen.getByRole('button', { name: 'Discover music' });
    expect(discoverBtn).toBeDisabled();
  });

  it('renders example prompt chips and clicking one submits search', async () => {
    const searchSpy = vi.spyOn(client, 'searchMusic').mockResolvedValue(MOCK_SEARCH_RESPONSE);
    const user = userEvent.setup();
    render(<App />);

    const chip = screen.getByRole('button', { name: /🌧 Rainy day focus/i });
    expect(chip).toBeInTheDocument();

    await user.click(chip);

    expect(searchSpy).toHaveBeenCalledWith(
      'Rainy day focus',
      expect.objectContaining({ discoveryMode: 'FAMILIAR' }),
      expect.any(AbortSignal)
    );

    // Results render
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /How I heard you/i })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Your listening mood')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /View search details/i })).not.toBeInTheDocument();
      expect(screen.getByText('Peaceful Mind')).toBeInTheDocument();
      expect(screen.getByText('Ambient Artist')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open "Peaceful Mind" on Spotify/i })).toHaveAttribute(
        'href',
        'https://open.spotify.com/track/track-1'
      );
    });

    await user.click(screen.getByRole('button', { name: /How I heard you/i }));
    expect(screen.getByRole('button', { name: /How I heard you/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Your listening mood')).toBeInTheDocument();
    expect(screen.getByText('peaceful study instrumental piano ambient')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /View details for Peaceful Mind/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute('src', 'https://example.com/art.jpg');
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Peaceful Mind' })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('Midnight Thoughts')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close song details' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('displays error card when search fails', async () => {
    vi.spyOn(client, 'searchMusic').mockRejectedValue(
      new client.AppApiError('GEMINI_UNAVAILABLE', 'The AI is overloaded right now.')
    );
    const user = userEvent.setup();
    render(<App />);

    const textarea = screen.getByRole('textbox', { name: /Describe what you want to listen to/i });
    await user.type(textarea, 'energetic beats');

    const discoverBtn = screen.getByRole('button', { name: 'Discover music' });
    await user.click(discoverBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('The AI is taking a breather')).toBeInTheDocument();
      expect(screen.getByText('The AI is overloaded right now.')).toBeInTheDocument();
    });
  });

  it('renders Connect Spotify button in notice banner when notice requests it', async () => {
    vi.spyOn(client, 'searchMusic').mockResolvedValue({
      ...MOCK_SEARCH_RESPONSE,
      mode: 'mock',
      notice: 'Operating in Mock Mode: Spotify authorization required. Click Connect Spotify.',
    });
    const user = userEvent.setup();
    render(<App />);

    const chip = screen.getByRole('button', { name: /🌧 Rainy day focus/i });
    await user.click(chip);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connect Spotify/i })).toBeInTheDocument();
    });
  });
});
