import {
  ExtensionMessage,
  SYNORA_EXTENSION_MESSAGE_SOURCE,
  SYNORA_PWA_MESSAGE_SOURCE,
  SynoraBridgeMessage,
} from '../types/messages';
import { AdapterRegistry } from '../adapters/Registry';
import { NetflixPlayerAdapter } from '../adapters/NetflixAdapter';

const EXTENSION_VERSION = '1.0.0';

console.log('[Synora Extension] Content script loaded on:', window.location.href);

function isAllowedPwaOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.hostname === 'localhost' ||
      url.hostname.endsWith('.run.app') ||
      url.hostname.includes('synora')
    );
  } catch {
    return false;
  }
}

function getSafeOrigin(): string {
  return typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : '*';
}

/**
 * 1. Watch Party PWA Communication Bridge
 * Listens for window.postMessage from the Synora web application and relays messages with background
 */
function setupWatchPartyBridge() {
  const safeOrigin = getSafeOrigin();

  // Relay messages from PWA to extension
  window.addEventListener('message', async (event: MessageEvent<SynoraBridgeMessage>) => {
    // Only accept messages from same window, matching source, and allowed origin
    if (
      event.source !== window ||
      !event.data ||
      event.data.source !== SYNORA_PWA_MESSAGE_SOURCE ||
      (event.origin && !isAllowedPwaOrigin(event.origin))
    ) {
      return;
    }

    const message = event.data;

    switch (message.type) {
      case 'SYNORA_HANDSHAKE_REQUEST': {
        // Query background service worker for active room
        try {
          chrome.runtime.sendMessage({ type: 'GET_STATUS' } as ExtensionMessage, (response) => {
            if (chrome.runtime.lastError) {
              // Service worker waking up or initializing
            }
            const connectedRoomId = response?.status?.roomInfo?.roomId || null;

            // Respond back to Watch Party PWA
            window.postMessage(
              {
                source: SYNORA_EXTENSION_MESSAGE_SOURCE,
                type: 'SYNORA_HANDSHAKE_RESPONSE',
                payload: {
                  extensionVersion: EXTENSION_VERSION,
                  extensionAvailable: true,
                  connectedRoomId,
                },
              },
              safeOrigin
            );
          });
        } catch {
          // Extension context may be reloading
        }
        break;
      }

      case 'SYNORA_ROOM_JOIN': {
        const { roomId, roomTitle, isHost } = message.payload;
        try {
          chrome.runtime.sendMessage({
            type: 'ROOM_STATE_UPDATED',
            roomInfo: {
              roomId,
              roomTitle,
              isHost,
              connectedAt: Date.now(),
            },
          } as ExtensionMessage, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
          });
        } catch {
          // Extension context invalidated
        }
        break;
      }

      case 'SYNORA_ROOM_LEAVE': {
        try {
          chrome.runtime.sendMessage({
            type: 'DISCONNECT_ROOM',
          } as ExtensionMessage, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
          });
        } catch {
          // Extension context invalidated
        }
        break;
      }

      case 'SYNORA_PLAYBACK_CONTROL': {
        const { action, time } = message.payload;
        try {
          chrome.runtime.sendMessage({
            type: 'CONTROL_PLAYBACK',
            action,
            time,
          } as ExtensionMessage, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
          });
        } catch {
          // Extension context invalidated
        }
        break;
      }

      case 'SYNORA_GET_PLAYBACK_STATE': {
        try {
          chrome.runtime.sendMessage({ type: 'GET_PLAYBACK_STATE' } as ExtensionMessage, (response) => {
            if (chrome.runtime.lastError) {
              // Handle runtime disconnect
            }
            window.postMessage(
              {
                source: SYNORA_EXTENSION_MESSAGE_SOURCE,
                type: 'SYNORA_PLAYBACK_STATE',
                payload: {
                  site: 'netflix',
                  isAvailable: Boolean(response?.state),
                  state: response?.state || null,
                  content: response?.content || null,
                },
              },
              safeOrigin
            );
          });
        } catch {
          // Extension context invalidated
        }
        break;
      }
    }
  });

  // Relay messages from Background to PWA
  chrome.runtime.onMessage.addListener((msg: ExtensionMessage) => {
    if (msg.type === 'PLAYBACK_STATE_CHANGED') {
      window.postMessage(
        {
          source: SYNORA_EXTENSION_MESSAGE_SOURCE,
          type: 'SYNORA_PLAYBACK_STATE',
          payload: {
            site: 'netflix',
            isAvailable: true,
            state: msg.state,
            content: msg.content || null,
          },
        },
        safeOrigin
      );
    }
  });

  // Proactively announce extension presence to PWA on load
  window.postMessage(
    {
      source: SYNORA_EXTENSION_MESSAGE_SOURCE,
      type: 'SYNORA_HANDSHAKE_RESPONSE',
      payload: {
        extensionVersion: EXTENSION_VERSION,
        extensionAvailable: true,
        connectedRoomId: null,
      },
    },
    safeOrigin
  );
}

/**
 * 2. Netflix Playback Integration
 * Instantiates adapter, subscribes to playback events, and responds to playback control messages
 */
async function setupNetflixIntegration() {
  console.log('[Synora Extension] Setting up Netflix player integration');
  const adapter = new NetflixPlayerAdapter();

  // Register adapter in registry
  const registry = AdapterRegistry.getInstance();
  registry.register(adapter);

  // Subscribe to playback events and notify background worker
  adapter.subscribeToPlayback(async (state) => {
    const identity = await adapter.getContentIdentity();
    try {
      chrome.runtime.sendMessage({
        type: 'PLAYBACK_STATE_CHANGED',
        state,
        content: identity,
      } as ExtensionMessage);
    } catch {
      // Extension context invalidated or service worker restarting
    }
  });

  // Proactively check initial content identity
  const identity = await adapter.getContentIdentity();
  if (identity) {
    console.log('[Synora Extension] Netflix content identified on startup:', identity);
    try {
      chrome.runtime.sendMessage({
        type: 'CONTENT_IDENTIFIED',
        content: identity,
      } as ExtensionMessage);
    } catch {
      // Ignore
    }
  }

  // Handle remote playback commands from background / PWA
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === 'CONTROL_PLAYBACK') {
      (async () => {
        try {
          if (message.action === 'play') {
            await adapter.play();
          } else if (message.action === 'pause') {
            await adapter.pause();
          } else if (message.action === 'seek' && typeof message.time === 'number') {
            await adapter.seek(message.time);
          }
          sendResponse({ ok: true });
        } catch (err) {
          console.warn('[Synora Extension] Error executing playback control:', err);
          sendResponse({ ok: false, error: String(err) });
        }
      })();
      return true; // Keep channel open for async response
    }

    if (message.type === 'GET_PLAYBACK_STATE') {
      (async () => {
        const isAvail = await adapter.isAvailable();
        if (!isAvail) {
          sendResponse({
            type: 'PLAYBACK_STATE_RESPONSE',
            state: null,
            content: null,
          });
          return;
        }

        const [time, duration, playing, content] = await Promise.all([
          adapter.getCurrentTime(),
          adapter.getDuration(),
          adapter.isPlaying(),
          adapter.getContentIdentity(),
        ]);

        sendResponse({
          type: 'PLAYBACK_STATE_RESPONSE',
          state: {
            currentTime: time,
            duration,
            isPlaying: playing,
            isBuffering: false,
            timestamp: Date.now(),
          },
          content,
        });
      })();
      return true;
    }
  });

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    adapter.destroy();
  });
}

// Initialize according to page location
if (
  window.location.hostname === 'localhost' ||
  window.location.hostname.includes('run.app') ||
  window.location.hostname.includes('synora')
) {
  setupWatchPartyBridge();
} else if (window.location.hostname.includes('netflix.com')) {
  setupNetflixIntegration();
}
