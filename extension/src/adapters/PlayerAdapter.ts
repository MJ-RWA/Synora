import { ContentIdentity, PlaybackState, PlaybackSubscriptionCallback, PlayerAdapter, UnsubscribeFunction } from '../types/adapter';

/**
 * Base abstract class providing common utility methods for site-specific adapters.
 */
export abstract class BasePlayerAdapter implements PlayerAdapter {
  abstract readonly siteId: string;
  abstract readonly displayName: string;

  abstract isAvailable(): Promise<boolean>;
  abstract getCurrentTime(): Promise<number>;
  abstract getDuration(): Promise<number>;
  abstract isPlaying(): Promise<boolean>;
  abstract play(): Promise<void>;
  abstract pause(): Promise<void>;
  abstract seek(timeSeconds: number): Promise<void>;
  abstract getContentIdentity(): Promise<ContentIdentity | null>;

  protected listeners: Set<PlaybackSubscriptionCallback> = new Set();

  subscribeToPlayback(callback: PlaybackSubscriptionCallback): UnsubscribeFunction {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  protected notifyPlaybackListeners(state: PlaybackState): void {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error(`[Synora][${this.displayName}] Playback listener error:`, err);
      }
    }
  }
}
