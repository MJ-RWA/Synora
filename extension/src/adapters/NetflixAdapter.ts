import { BasePlayerAdapter } from './PlayerAdapter';
import { ContentIdentity, PlaybackState, PlaybackSubscriptionCallback, UnsubscribeFunction } from '../types/adapter';

/**
 * Diagnostics logger for development mode.
 */
const DEBUG = true;

function logDebug(...args: unknown[]) {
  if (DEBUG) {
    console.debug('[Synora][NetflixAdapter]', ...args);
  }
}

function logWarn(...args: unknown[]) {
  console.warn('[Synora][NetflixAdapter]', ...args);
}

function logError(...args: unknown[]) {
  console.error('[Synora][NetflixAdapter]', ...args);
}

/**
 * NetflixPlayerAdapter: Implements detection and control for Netflix web player.
 * Follows least-privilege principles without accessing credentials, cookies, DRM keys or media streams.
 */
export class NetflixPlayerAdapter extends BasePlayerAdapter {
  readonly siteId = 'netflix';
  readonly displayName = 'Netflix';

  private activeVideoElement: HTMLVideoElement | null = null;
  private domObserver: MutationObserver | null = null;
  private isDestroyed = false;
  private lastKnownContentIdentity: ContentIdentity | null = null;
  private boundVideoListeners: Map<string, EventListener> = new Map();
  private lastEmittedTime = 0;
  private lastEmittedPlayState: boolean | null = null;
  private throttleTimeout: number | null = null;
  private urlCheckInterval: number | null = null;
  private lastUrl = '';

  constructor() {
    super();
    this.initLifecycle();
  }

  /**
   * Initializes content script lifecycle listeners (navigation, unloading, DOM changes).
   */
  private initLifecycle(): void {
    if (typeof window === 'undefined') return;

    this.lastUrl = window.location.href;
    logDebug('Initializing Netflix player adapter lifecycle on', this.lastUrl);

    // 1. Hook SPA history transitions for client-side routing
    try {
      const originalPushState = history.pushState.bind(history);
      const originalReplaceState = history.replaceState.bind(history);

      history.pushState = (...args: Parameters<History['pushState']>) => {
        originalPushState(...args);
        this.handleUrlOrNavigationChange();
      };

      history.replaceState = (...args: Parameters<History['replaceState']>) => {
        originalReplaceState(...args);
        this.handleUrlOrNavigationChange();
      };
    } catch (e) {
      logWarn('Could not wrap history navigation APIs:', e);
    }

    window.addEventListener('popstate', () => {
      this.handleUrlOrNavigationChange();
    });

    // Low-frequency safety poll (every 1.5s) to catch subtle SPA route changes without CPU overhead
    this.urlCheckInterval = window.setInterval(() => {
      if (this.isDestroyed) return;
      if (window.location.href !== this.lastUrl) {
        this.handleUrlOrNavigationChange();
      }
    }, 1500);

    // 2. Observe DOM mutations for video mounting/unmounting
    this.setupMutationObserver();

    // 3. Cleanup on page unload or teardown
    window.addEventListener('beforeunload', () => this.destroy());
    window.addEventListener('pagehide', () => this.destroy());

    // Initial check for existing video element
    this.findAndAttachVideoElement();
  }

  /**
   * Detects if current page is on a valid Netflix watch URL.
   */
  public isNetflixWatchPage(): boolean {
    if (typeof window === 'undefined') return false;
    const isDomain = window.location.hostname.includes('netflix.com');
    const isWatch = window.location.pathname.startsWith('/watch/');
    return isDomain && isWatch;
  }

  /**
   * Check if player is present and mounted in active DOM.
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isNetflixWatchPage()) {
      return false;
    }
    const video = this.findVideoElement();
    return Boolean(video && video.isConnected && video.readyState >= 1);
  }

  /**
   * Finds the active Netflix video element using standard selectors.
   */
  private findVideoElement(): HTMLVideoElement | null {
    if (typeof document === 'undefined') return null;

    // Search for video elements in Netflix player container across variants
    const video = (
      document.querySelector('.watch-video--player video') ||
      document.querySelector('.watch-video video') ||
      document.querySelector('[data-uia="watch-video"] video') ||
      document.querySelector('div[data-uia="video-canvas"] video') ||
      document.querySelector('.AkiraPlayer video') ||
      document.querySelector('video.player-video') ||
      document.querySelector('video')
    ) as HTMLVideoElement | null;

    if (video && video.isConnected) {
      return video;
    }
    return null;
  }

  /**
   * Attaches listeners to the active video element without duplicate registrations.
   */
  private findAndAttachVideoElement(): void {
    if (this.isDestroyed) return;

    if (!this.isNetflixWatchPage()) {
      if (this.activeVideoElement) {
        logDebug('Exited Netflix playback page. Detaching video element listeners.');
        this.detachVideoListeners();
      }
      return;
    }

    const video = this.findVideoElement();
    if (video && video !== this.activeVideoElement) {
      logDebug('Found active Netflix video player element:', video);
      this.attachVideoListeners(video);
    }
  }

  /**
   * Sets up MutationObserver to detect player element loading / unloading.
   */
  private setupMutationObserver(): void {
    if (typeof document === 'undefined' || !document.body) return;

    this.domObserver = new MutationObserver(() => {
      if (this.isDestroyed) return;
      this.findAndAttachVideoElement();
    });

    this.domObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Detaches event listeners from previous video element.
   */
  private detachVideoListeners(): void {
    if (!this.activeVideoElement) return;

    logDebug('Cleaning up active video event listeners');
    this.boundVideoListeners.forEach((handler, eventName) => {
      this.activeVideoElement?.removeEventListener(eventName, handler);
    });

    this.boundVideoListeners.clear();
    this.activeVideoElement = null;
  }

  /**
   * Attaches native event listeners to video element.
   * Prevents duplicate registrations.
   */
  private attachVideoListeners(video: HTMLVideoElement): void {
    this.detachVideoListeners();
    this.activeVideoElement = video;

    const createHandler = (eventName: string, handler: (e: Event) => void) => {
      this.boundVideoListeners.set(eventName, handler as EventListener);
      video.addEventListener(eventName, handler as EventListener);
    };

    // Immediate playback state change handlers
    createHandler('play', () => {
      logDebug('Video play event detected');
      this.emitCurrentPlaybackState();
    });

    createHandler('pause', () => {
      logDebug('Video pause event detected');
      this.emitCurrentPlaybackState();
    });

    createHandler('seeking', () => {
      logDebug('Video seeking event detected');
      this.emitCurrentPlaybackState(true);
    });

    createHandler('seeked', () => {
      logDebug('Video seeked event detected');
      this.emitCurrentPlaybackState(false);
    });

    createHandler('waiting', () => {
      logDebug('Video buffering (waiting) detected');
      this.emitCurrentPlaybackState(true);
    });

    createHandler('playing', () => {
      logDebug('Video playing event detected');
      this.emitCurrentPlaybackState(false);
    });

    createHandler('ended', () => {
      logDebug('Video ended event detected');
      this.emitCurrentPlaybackState(false);
    });

    createHandler('durationchange', () => {
      logDebug('Video duration changed:', video.duration);
      this.emitCurrentPlaybackState();
    });

    createHandler('error', () => {
      logWarn('Video element reported error state');
      this.emitCurrentPlaybackState(false);
    });

    createHandler('stalled', () => {
      logWarn('Video playback stalled');
      this.emitCurrentPlaybackState(true);
    });

    // Throttled timeupdate handler to avoid high frequency polling
    createHandler('timeupdate', () => {
      const current = video.currentTime;

      // Only notify if time has progressed by at least 0.5s and not throttled
      if (Math.abs(current - this.lastEmittedTime) >= 0.5) {
        if (this.throttleTimeout) return;

        this.throttleTimeout = window.setTimeout(() => {
          this.throttleTimeout = null;
          this.emitCurrentPlaybackState();
        }, 500);
      }
    });

    logDebug('Successfully attached event listeners to active Netflix video element');
    // Emit initial state
    this.emitCurrentPlaybackState();
  }

  /**
   * Emits the current playback state to subscribers.
   */
  private emitCurrentPlaybackState(isBufferingOverride?: boolean): void {
    if (this.isDestroyed) return;

    const video = this.activeVideoElement || this.findVideoElement();
    if (!video) {
      // If no video, emit stopped state
      if (this.lastEmittedPlayState !== null) {
        this.lastEmittedPlayState = null;
        this.notifyPlaybackListeners({
          currentTime: 0,
          duration: 0,
          isPlaying: false,
          isBuffering: false,
          timestamp: Date.now(),
        });
      }
      return;
    }

    const currentTime = isFinite(video.currentTime) && !isNaN(video.currentTime) ? Math.max(0, video.currentTime) : 0;
    const duration = isFinite(video.duration) && !isNaN(video.duration) ? Math.max(0, video.duration) : 0;
    const isPlaying = !video.paused && !video.ended && video.readyState > 2;
    const isBuffering = isBufferingOverride !== undefined ? isBufferingOverride : (video.seeking || video.readyState < 3);

    this.lastEmittedTime = currentTime;
    this.lastEmittedPlayState = isPlaying;

    const state: PlaybackState = {
      currentTime,
      duration,
      isPlaying,
      isBuffering,
      timestamp: Date.now(),
    };

    this.notifyPlaybackListeners(state);
  }

  /**
   * Handles SPA URL change or navigation transition.
   */
  private async handleUrlOrNavigationChange(): Promise<void> {
    if (typeof window === 'undefined') return;
    const currentUrl = window.location.href;
    if (currentUrl === this.lastUrl) return;

    logDebug(`Navigation detected from ${this.lastUrl} to ${currentUrl}`);
    this.lastUrl = currentUrl;

    if (!this.isNetflixWatchPage()) {
      logDebug('Navigated away from watch page to browse/other view');
      this.detachVideoListeners();
      this.lastKnownContentIdentity = null;
      this.emitCurrentPlaybackState();
      return;
    }

    // Still on a watch page, possibly changed titles / episodes
    this.findAndAttachVideoElement();

    const identity = await this.getContentIdentity();
    if (identity && (!this.lastKnownContentIdentity || identity.id !== this.lastKnownContentIdentity.id)) {
      logDebug('Detected title / episode content change:', identity);
      this.lastKnownContentIdentity = identity;
      // Trigger any registered content listeners or bridge messages
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({
            type: 'CONTENT_IDENTIFIED',
            content: identity,
          });
        } catch {
          // Extension context may be unloaded
        }
      }
    }
  }

  /**
   * Gets the current playback time in seconds.
   */
  async getCurrentTime(): Promise<number> {
    const video = this.findVideoElement();
    if (!video) return 0;
    const time = video.currentTime;
    return isFinite(time) && !isNaN(time) ? Math.max(0, time) : 0;
  }

  /**
   * Gets the total video duration in seconds.
   */
  async getDuration(): Promise<number> {
    const video = this.findVideoElement();
    if (!video) return 0;
    const duration = video.duration;
    return isFinite(duration) && !isNaN(duration) ? Math.max(0, duration) : 0;
  }

  /**
   * Gets the active playing status.
   */
  async isPlaying(): Promise<boolean> {
    const video = this.findVideoElement();
    if (!video) return false;
    return !video.paused && !video.ended && video.readyState > 2;
  }

  /**
   * Requests the video to play.
   * Uses video.play() and falls back to UI click or standard space event if restricted.
   */
  async play(): Promise<void> {
    const video = this.findVideoElement();
    if (!video) {
      throw new Error('Netflix player element is not active or mounted in DOM.');
    }

    if (!video.paused) {
      logDebug('Player is already playing.');
      return;
    }

    logDebug('Initiating play() command on Netflix player');
    try {
      await video.play();
      logDebug('video.play() resolved successfully');
    } catch (directErr) {
      logWarn('video.play() was prevented by browser autoplay or page policy, trying UI trigger:', directErr);
      
      // Attempt click on Netflix play button
      const playBtn = (
        document.querySelector('button[data-uia="control-play-pause-play"]') ||
        document.querySelector('button[aria-label="Play"]') ||
        document.querySelector('[data-uia="play-button"]')
      ) as HTMLElement | null;

      if (playBtn) {
        logDebug('Clicking native Netflix play button');
        playBtn.click();
      } else {
        // Dispatch spacebar keyboard event
        logDebug('Dispatching spacebar event to toggle play');
        const spaceEvent = new KeyboardEvent('keydown', {
          key: ' ',
          code: 'Space',
          keyCode: 32,
          which: 32,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(spaceEvent);
      }
    }

    // Verify after short grace period
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (video.paused) {
      logWarn('Netflix playback state remained paused after play request. Player may require manual user interaction.');
    }
  }

  /**
   * Requests the video to pause.
   */
  async pause(): Promise<void> {
    const video = this.findVideoElement();
    if (!video) {
      throw new Error('Netflix player element is not active or mounted in DOM.');
    }

    if (video.paused) {
      logDebug('Player is already paused.');
      return;
    }

    logDebug('Initiating pause() command on Netflix player');
    try {
      video.pause();
      logDebug('video.pause() invoked successfully');
    } catch (directErr) {
      logWarn('video.pause() threw an exception, trying UI pause button:', directErr);
      const pauseBtn = (
        document.querySelector('button[data-uia="control-play-pause-pause"]') ||
        document.querySelector('button[aria-label="Pause"]')
      ) as HTMLElement | null;

      if (pauseBtn) {
        logDebug('Clicking native Netflix pause button');
        pauseBtn.click();
      } else {
        const spaceEvent = new KeyboardEvent('keydown', {
          key: ' ',
          code: 'Space',
          keyCode: 32,
          which: 32,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(spaceEvent);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
    if (!video.paused) {
      logWarn('Netflix playback state remained playing after pause request.');
    }
  }

  /**
   * Seeks to a specific playback position in seconds.
   */
  async seek(timeSeconds: number): Promise<void> {
    const video = this.findVideoElement();
    if (!video) {
      throw new Error('Netflix player element is not active or mounted in DOM.');
    }

    const duration = isFinite(video.duration) ? video.duration : 0;
    const targetTime = Math.max(0, duration > 0 ? Math.min(timeSeconds, duration) : timeSeconds);

    logDebug(`Initiating seek() to ${targetTime}s (current: ${video.currentTime}s)`);

    try {
      video.currentTime = targetTime;
      video.dispatchEvent(new Event('seeking'));
      video.dispatchEvent(new Event('seeked'));
    } catch (seekErr) {
      logError('Direct seek on video element failed:', seekErr);
      throw new Error(`Netflix seek failed: ${String(seekErr)}`, { cause: seekErr });
    }

    // Honest verification
    await new Promise((resolve) => setTimeout(resolve, 200));
    const timeDiff = Math.abs(video.currentTime - targetTime);
    if (timeDiff > 2.0 && duration > 0) {
      logWarn(`Seek discrepancy detected: requested ${targetTime}s, actual is ${video.currentTime}s. Netflix player buffering or DRM pipeline may require native controls interaction.`);
    } else {
      logDebug(`Seek verified at ${video.currentTime}s`);
    }
  }

  /**
   * Resolves content metadata and ID from URL and page DOM.
   */
  async getContentIdentity(): Promise<ContentIdentity | null> {
    if (typeof window === 'undefined') return null;

    const url = window.location.href;
    const match = window.location.pathname.match(/\/watch\/(\d+)/);
    if (!match) {
      return null;
    }

    const titleId = match[1];

    // Extract title text from Netflix DOM if available
    let titleText: string | undefined;
    const titleEl = (
      document.querySelector('[data-uia="video-title"]') ||
      document.querySelector('.video-title') ||
      document.querySelector('h4[data-uia="video-title"]') ||
      document.querySelector('[data-uia="control-header"]')
    );

    if (titleEl && titleEl.textContent) {
      titleText = titleEl.textContent.trim();
    } else if (document.title) {
      titleText = document.title.replace(/\s*-\s*Netflix$/i, '').trim();
    }

    // Try parsing Season / Episode if present
    let season: number | undefined;
    let episode: number | undefined;
    if (titleText) {
      const sMatch = titleText.match(/S(?:eason)?\s*(\d+)/i);
      const eMatch = titleText.match(/E(?:pisode)?\s*(\d+)/i);
      if (sMatch) season = parseInt(sMatch[1], 10);
      if (eMatch) episode = parseInt(eMatch[1], 10);
    }

    return {
      site: 'netflix',
      id: titleId,
      title: titleText,
      season,
      episode,
      rawUrl: url,
    };
  }

  /**
   * Subscribes to playback state updates with listener cleanup returned.
   */
  override subscribeToPlayback(callback: PlaybackSubscriptionCallback): UnsubscribeFunction {
    const unsub = super.subscribeToPlayback(callback);
    // Immediately emit current state if available
    this.emitCurrentPlaybackState();
    return unsub;
  }

  /**
   * Comprehensive cleanup on unload or disconnect.
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    logDebug('Destroying NetflixPlayerAdapter and cleaning up all resources');

    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
      this.throttleTimeout = null;
    }

    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }

    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }

    this.detachVideoListeners();
    this.listeners.clear();
  }
}

/**
 * Backward compatibility export
 */
export { NetflixPlayerAdapter as NetflixAdapter };

