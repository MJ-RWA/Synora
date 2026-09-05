import { BasePlayerAdapter } from './PlayerAdapter';
import { ContentIdentity } from '../types/adapter';

/**
 * Netflix Adapter Foundation.
 * Detects presence of Netflix watch page and title ID.
 * Core playback control methods are strictly stubbed for the upcoming Phase 3 synchronization implementation.
 */
export class NetflixAdapter extends BasePlayerAdapter {
  readonly siteId = 'netflix';
  readonly displayName = 'Netflix';

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const isNetflixDomain = window.location.hostname.includes('netflix.com');
    const isWatchUrl = window.location.pathname.startsWith('/watch');
    return isNetflixDomain && isWatchUrl;
  }

  async getContentIdentity(): Promise<ContentIdentity | null> {
    if (typeof window === 'undefined') return null;
    const url = window.location.href;
    const match = window.location.pathname.match(/\/watch\/(\d+)/);
    if (!match) return null;

    return {
      site: 'netflix',
      id: match[1],
      rawUrl: url,
    };
  }

  async getCurrentTime(): Promise<number> {
    throw new Error('NetflixAdapter: Playback sync is scheduled for Phase 3.');
  }

  async getDuration(): Promise<number> {
    throw new Error('NetflixAdapter: Playback sync is scheduled for Phase 3.');
  }

  async isPlaying(): Promise<boolean> {
    throw new Error('NetflixAdapter: Playback sync is scheduled for Phase 3.');
  }

  async play(): Promise<void> {
    throw new Error('NetflixAdapter: Playback sync is scheduled for Phase 3.');
  }

  async pause(): Promise<void> {
    throw new Error('NetflixAdapter: Playback sync is scheduled for Phase 3.');
  }

  async seek(_timeSeconds: number): Promise<void> {
    void _timeSeconds;
    throw new Error('NetflixAdapter: Playback sync is scheduled for Phase 3.');
  }
}
