import { ContentIdentity, PlaybackState } from '../types/adapter';
import { ExtensionMessage, ExtensionStatus, RoomConnectionInfo, SiteType } from '../types/messages';

const EXTENSION_VERSION = '1.0.0';

/**
 * Storage keys
 */
const STORAGE_KEY_ROOM = 'synora_active_room';
const STORAGE_KEY_PLAYBACK = 'synora_playback_state';
const STORAGE_KEY_CONTENT = 'synora_content_identity';

/**
 * Runtime memory caches for Netflix playback
 */
let latestPlaybackState: PlaybackState | null = null;
let latestContentIdentity: ContentIdentity | null = null;
let activeNetflixTabId: number | null = null;

// Hydrate state from storage when service worker wakes up
chrome.storage.local
  .get([STORAGE_KEY_ROOM, STORAGE_KEY_PLAYBACK, STORAGE_KEY_CONTENT])
  .then((stored) => {
    if (stored[STORAGE_KEY_PLAYBACK]) latestPlaybackState = stored[STORAGE_KEY_PLAYBACK];
    if (stored[STORAGE_KEY_CONTENT]) latestContentIdentity = stored[STORAGE_KEY_CONTENT];
  })
  .catch(() => {});

/**
 * Helper to identify supported site category from a URL string
 */
function classifyUrl(urlStr: string): { site: SiteType; supported: boolean } {
  try {
    const url = new URL(urlStr);
    if (url.hostname.includes('netflix.com')) {
      return { site: 'netflix', supported: true };
    }
    // Watch Party PWA origins (localhost or cloud run deployment)
    if (
      url.hostname === 'localhost' ||
      url.hostname.includes('run.app') ||
      url.hostname.includes('synora')
    ) {
      return { site: 'watchparty', supported: true };
    }
  } catch {
    // Malformed URL
  }
  return { site: 'unsupported', supported: false };
}

/**
 * Retrieves the current persisted room connection info
 */
async function getActiveRoom(): Promise<RoomConnectionInfo | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY_ROOM);
  return result[STORAGE_KEY_ROOM] || null;
}

/**
 * Saves active room info
 */
async function setActiveRoom(room: RoomConnectionInfo | null): Promise<void> {
  if (room) {
    await chrome.storage.local.set({ [STORAGE_KEY_ROOM]: room });
  } else {
    await chrome.storage.local.remove(STORAGE_KEY_ROOM);
  }
}

/**
 * Broadcasts playback state updates to all open Watch Party PWA tabs
 */
async function broadcastPlaybackToPwaTabs(state: PlaybackState, content?: ContentIdentity | null) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (
        tab.id &&
        tab.url &&
        (tab.url.includes('localhost') || tab.url.includes('run.app') || tab.url.includes('synora'))
      ) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'PLAYBACK_STATE_CHANGED',
          state,
          content: content || latestContentIdentity,
        } as ExtensionMessage).catch(() => {});
      }
    }
  } catch {
    // Suppress tab broadcast query errors
  }
}

/**
 * Finds an active or open Netflix playback tab
 */
async function getOrFindNetflixTabId(): Promise<number | null> {
  if (activeNetflixTabId) {
    try {
      const tab = await chrome.tabs.get(activeNetflixTabId);
      if (tab && tab.url && tab.url.includes('netflix.com')) {
        return tab.id || null;
      }
    } catch {
      activeNetflixTabId = null;
    }
  }

  const netflixTabs = await chrome.tabs.query({ url: '*://*.netflix.com/*' });
  if (netflixTabs.length > 0) {
    // Prefer watch tab
    const watchTab = netflixTabs.find((t) => t.url && t.url.includes('/watch/'));
    const chosen = watchTab || netflixTabs[0];
    if (chosen && chosen.id) {
      activeNetflixTabId = chosen.id;
      return chosen.id;
    }
  }
  return null;
}

/**
 * Lifecycle: Initialization on install or update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[Synora Extension] Service Worker installed/updated. Reason: ${details.reason}`);
  
  // Initialize default storage if needed
  const existing = await chrome.storage.local.get(STORAGE_KEY_ROOM);
  if (!existing[STORAGE_KEY_ROOM]) {
    await chrome.storage.local.set({ [STORAGE_KEY_ROOM]: null });
  }
});

// Reset cached tab if closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeNetflixTabId) {
    activeNetflixTabId = null;
    latestPlaybackState = null;
    latestContentIdentity = null;
    broadcastPlaybackToPwaTabs(
      {
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        isBuffering: false,
        timestamp: Date.now(),
      },
      null
    );
  }
});

// Detect when Netflix tab navigates to/from watch page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes('netflix.com')) {
    if (tabId === activeNetflixTabId) {
      if (changeInfo.url && !changeInfo.url.includes('/watch/')) {
        // Navigated away from watch page
        latestPlaybackState = null;
        latestContentIdentity = null;
        broadcastPlaybackToPwaTabs(
          {
            currentTime: 0,
            duration: 0,
            isPlaying: false,
            isBuffering: false,
            timestamp: Date.now(),
          },
          null
        );
      }
    } else if (tab.url.includes('/watch/')) {
      activeNetflixTabId = tabId;
    }
  }
});

/**
 * Message Dispatcher
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  // Handle messages asynchronously
  (async () => {
    switch (message.type) {
      case 'PING': {
        const room = await getActiveRoom();
        const tabUrl = sender.tab?.url || '';
        const { site, supported } = classifyUrl(tabUrl);
        const netflixTabId = await getOrFindNetflixTabId();
        let netflixTabUrl: string | undefined;
        if (netflixTabId) {
          try {
            const netflixTab = await chrome.tabs.get(netflixTabId);
            netflixTabUrl = netflixTab?.url;
          } catch {
            // Tab may have closed
          }
        }

        const isNetflixWatch = Boolean(netflixTabUrl && netflixTabUrl.includes('/watch/'));

        const status: ExtensionStatus = {
          version: EXTENSION_VERSION,
          currentSite: site,
          siteUrl: tabUrl,
          siteSupported: supported,
          playerAvailable: site === 'netflix' && tabUrl.includes('/watch/'),
          connectionState: room ? 'connected' : 'disconnected',
          roomInfo: room,
          lastError: null,
          netflix: {
            tabFound: Boolean(netflixTabId),
            tabUrl: netflixTabUrl,
            isWatchPage: isNetflixWatch,
            playerAvailable: isNetflixWatch && Boolean(latestPlaybackState),
            state: latestPlaybackState,
            content: latestContentIdentity,
          },
        };
        sendResponse({ type: 'PONG', status });
        break;
      }

      case 'GET_STATUS': {
        const room = await getActiveRoom();
        // Query current active tab
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabUrl = activeTab?.url || '';
        const { site, supported } = classifyUrl(tabUrl);

        const netflixTabId = await getOrFindNetflixTabId();
        let netflixTabUrl: string | undefined;
        if (netflixTabId) {
          try {
            const netflixTab = await chrome.tabs.get(netflixTabId);
            netflixTabUrl = netflixTab?.url;
          } catch {
            // Tab may have closed
          }
        }

        const isNetflixWatch = Boolean(netflixTabUrl && netflixTabUrl.includes('/watch/'));

        const status: ExtensionStatus = {
          version: EXTENSION_VERSION,
          currentSite: site,
          siteUrl: tabUrl,
          siteSupported: supported,
          playerAvailable: site === 'netflix' && tabUrl.includes('/watch/'),
          connectionState: room ? 'connected' : 'disconnected',
          roomInfo: room,
          lastError: null,
          netflix: {
            tabFound: Boolean(netflixTabId),
            tabUrl: netflixTabUrl,
            isWatchPage: isNetflixWatch,
            playerAvailable: isNetflixWatch && Boolean(latestPlaybackState),
            state: latestPlaybackState,
            content: latestContentIdentity,
          },
        };
        sendResponse({ type: 'STATUS_RESPONSE', status });
        break;
      }

      case 'CHECK_SITE_SUPPORT': {
        const { site, supported } = classifyUrl(message.url);
        sendResponse({
          type: 'SITE_SUPPORT_RESULT',
          site,
          supported,
          playerAvailable: site === 'netflix' && message.url.includes('/watch/'),
        });
        break;
      }

      case 'CONNECT_ROOM': {
        const newRoom: RoomConnectionInfo = {
          roomId: message.roomId.trim().toUpperCase(),
          connectedAt: Date.now(),
        };
        await setActiveRoom(newRoom);
        sendResponse({ type: 'ROOM_STATE_UPDATED', roomInfo: newRoom });
        break;
      }

      case 'DISCONNECT_ROOM': {
        await setActiveRoom(null);
        sendResponse({ type: 'ROOM_STATE_UPDATED', roomInfo: null });
        break;
      }

      case 'ROOM_STATE_UPDATED': {
        await setActiveRoom(message.roomInfo);
        sendResponse({ ok: true });
        break;
      }

      case 'PLAYBACK_STATE_CHANGED': {
        latestPlaybackState = message.state;
        if (message.content) {
          latestContentIdentity = message.content;
        }
        if (sender.tab?.id) {
          activeNetflixTabId = sender.tab.id;
        }
        await chrome.storage.local.set({
          [STORAGE_KEY_PLAYBACK]: latestPlaybackState,
          [STORAGE_KEY_CONTENT]: latestContentIdentity,
        });
        await broadcastPlaybackToPwaTabs(message.state, message.content);
        sendResponse({ ok: true });
        break;
      }

      case 'CONTENT_IDENTIFIED': {
        latestContentIdentity = message.content;
        if (sender.tab?.id) {
          activeNetflixTabId = sender.tab.id;
        }
        await chrome.storage.local.set({
          [STORAGE_KEY_CONTENT]: latestContentIdentity,
        });
        sendResponse({ ok: true });
        break;
      }

      case 'GET_PLAYBACK_STATE': {
        const netflixTabId = await getOrFindNetflixTabId();
        if (netflixTabId) {
          try {
            chrome.tabs.sendMessage(netflixTabId, { type: 'GET_PLAYBACK_STATE' } as ExtensionMessage, (res) => {
              if (res) {
                sendResponse(res);
              } else {
                sendResponse({
                  type: 'PLAYBACK_STATE_RESPONSE',
                  state: latestPlaybackState,
                  content: latestContentIdentity,
                });
              }
            });
            return;
          } catch {
            // Fallback to cached
          }
        }
        sendResponse({
          type: 'PLAYBACK_STATE_RESPONSE',
          state: latestPlaybackState,
          content: latestContentIdentity,
        });
        break;
      }

      case 'CONTROL_PLAYBACK': {
        const netflixTabId = await getOrFindNetflixTabId();
        if (!netflixTabId) {
          sendResponse({ ok: false, error: 'No active Netflix tab found to control.' });
          return;
        }

        chrome.tabs.sendMessage(netflixTabId, message, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response || { ok: true });
          }
        });
        break;
      }

      default:
        break;
    }
  })().catch((err) => {
    console.error('[Synora Extension] Service Worker message handling error:', err);
    sendResponse({ error: String(err) });
  });

  // Return true to indicate asynchronous response
  return true;
});
