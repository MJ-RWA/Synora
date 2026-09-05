import {
  ExtensionMessage,
  SYNORA_EXTENSION_MESSAGE_SOURCE,
  SYNORA_PWA_MESSAGE_SOURCE,
  SynoraBridgeMessage,
} from '../types/messages';
import { AdapterRegistry } from '../adapters/Registry';

const EXTENSION_VERSION = '1.0.0';

console.log('[Synora Extension] Content script loaded on:', window.location.href);

/**
 * 1. Watch Party PWA Communication Bridge
 * Listens for window.postMessage from the Synora web application
 */
function setupWatchPartyBridge() {
  window.addEventListener('message', async (event: MessageEvent<SynoraBridgeMessage>) => {
    // Only accept messages from same window and matching source
    if (event.source !== window || !event.data || event.data.source !== SYNORA_PWA_MESSAGE_SOURCE) {
      return;
    }

    const message = event.data;

    switch (message.type) {
      case 'SYNORA_HANDSHAKE_REQUEST': {
        // Query background service worker for active room
        chrome.runtime.sendMessage({ type: 'GET_STATUS' } as ExtensionMessage, (response) => {
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
            '*'
          );
        });
        break;
      }

      case 'SYNORA_ROOM_JOIN': {
        const { roomId, roomTitle, isHost } = message.payload;
        chrome.runtime.sendMessage({
          type: 'ROOM_STATE_UPDATED',
          roomInfo: {
            roomId,
            roomTitle,
            isHost,
            connectedAt: Date.now(),
          },
        } as ExtensionMessage);
        break;
      }

      case 'SYNORA_ROOM_LEAVE': {
        chrome.runtime.sendMessage({
          type: 'DISCONNECT_ROOM',
        } as ExtensionMessage);
        break;
      }
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
    '*'
  );
}

/**
 * 2. Supported Site Detection (Netflix, etc.)
 */
async function setupSiteDetection() {
  const registry = AdapterRegistry.getInstance();
  const adapter = await registry.resolveForUrl(window.location.href);

  if (adapter) {
    console.log(`[Synora Extension] Detected supported media site: ${adapter.displayName}`);
    const identity = await adapter.getContentIdentity();
    if (identity) {
      console.log(`[Synora Extension] Media identity identified:`, identity);
      chrome.runtime.sendMessage({
        type: 'CONTENT_IDENTIFIED',
        content: identity,
      } as ExtensionMessage);
    }
  }
}

// Initialize according to page location
if (
  window.location.hostname === 'localhost' ||
  window.location.hostname.includes('run.app') ||
  window.location.hostname.includes('synora')
) {
  setupWatchPartyBridge();
} else if (window.location.hostname.includes('netflix.com')) {
  setupSiteDetection();
}
