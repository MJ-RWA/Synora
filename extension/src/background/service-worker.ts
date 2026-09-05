import { ExtensionMessage, ExtensionStatus, RoomConnectionInfo, SiteType } from '../types/messages';

const EXTENSION_VERSION = '1.0.0';

/**
 * Storage keys
 */
const STORAGE_KEY_ROOM = 'synora_active_room';

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

        const status: ExtensionStatus = {
          version: EXTENSION_VERSION,
          currentSite: site,
          siteUrl: tabUrl,
          siteSupported: supported,
          playerAvailable: site === 'netflix',
          connectionState: room ? 'connected' : 'disconnected',
          roomInfo: room,
          lastError: null,
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

        const status: ExtensionStatus = {
          version: EXTENSION_VERSION,
          currentSite: site,
          siteUrl: tabUrl,
          siteSupported: supported,
          playerAvailable: site === 'netflix' && tabUrl.includes('/watch'),
          connectionState: room ? 'connected' : 'disconnected',
          roomInfo: room,
          lastError: null,
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
          playerAvailable: site === 'netflix' && message.url.includes('/watch'),
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
