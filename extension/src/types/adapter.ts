export interface ContentIdentity {
  site: 'netflix' | 'youtube' | 'custom' | string;
  id: string; // e.g. title ID, video ID, or watch slug
  title?: string;
  season?: number;
  episode?: number;
  rawUrl: string;
}

export interface PlaybackState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isBuffering: boolean;
  timestamp: number;
}

export type PlaybackSubscriptionCallback = (state: PlaybackState) => void;
export type UnsubscribeFunction = () => void;

/**
 * Common abstraction contract for media player integrations.
 * Future streaming platforms (Netflix, etc.) implement this interface
 * without changing the core watch party messaging pipeline.
 */
export interface PlayerAdapter {
  readonly siteId: string;
  readonly displayName: string;

  /**
   * Verifies if the player is present and mounted in the active DOM/frame.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Current playback time in seconds.
   */
  getCurrentTime(): Promise<number>;

  /**
   * Total media duration in seconds.
   */
  getDuration(): Promise<number>;

  /**
   * Active playing/paused status.
   */
  isPlaying(): Promise<boolean>;

  /**
   * Initiate playback.
   */
  play(): Promise<void>;

  /**
   * Pause playback.
   */
  pause(): Promise<void>;

  /**
   * Seek to specific position in seconds.
   */
  seek(timeSeconds: number): Promise<void>;

  /**
   * Resolves content metadata and ID.
   */
  getContentIdentity(): Promise<ContentIdentity | null>;

  /**
   * Subscribes to playback state changes.
   * Returns a cleanup function.
   */
  subscribeToPlayback(callback: PlaybackSubscriptionCallback): UnsubscribeFunction;
}
