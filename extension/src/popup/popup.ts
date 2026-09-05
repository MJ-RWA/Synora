import { ExtensionMessage, ExtensionStatus } from '../types/messages';

const siteStatusDot = document.getElementById('siteStatusDot') as HTMLSpanElement;
const siteInfoText = document.getElementById('siteInfoText') as HTMLDivElement;
const siteSubtext = document.getElementById('siteSubtext') as HTMLDivElement;
const connectionPill = document.getElementById('connectionPill') as HTMLSpanElement;
const connectedState = document.getElementById('connectedState') as HTMLDivElement;
const disconnectedState = document.getElementById('disconnectedState') as HTMLDivElement;
const displayRoomId = document.getElementById('displayRoomId') as HTMLElement;
const roomInput = document.getElementById('roomInput') as HTMLInputElement;
const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnectBtn') as HTMLButtonElement;
const openAppBtn = document.getElementById('openAppBtn') as HTMLButtonElement;

/**
 * Render extension status onto the popup UI
 */
function renderStatus(status: ExtensionStatus) {
  // 1. Site Status
  if (status.currentSite === 'netflix') {
    siteStatusDot.className = 'status-indicator active';
    if (status.playerAvailable) {
      siteInfoText.textContent = 'Netflix Player Active';
      siteSubtext.textContent = 'Ready for upcoming playback sync integration.';
    } else {
      siteInfoText.textContent = 'Netflix Detected';
      siteSubtext.textContent = 'Navigate to a video watch page to link playback.';
    }
  } else if (status.currentSite === 'watchparty') {
    siteStatusDot.className = 'status-indicator active';
    siteInfoText.textContent = 'Synora Watch Party App';
    siteSubtext.textContent = 'Connected directly to web app tab.';
  } else {
    siteStatusDot.className = 'status-indicator';
    siteInfoText.textContent = 'Unsupported Site';
    siteSubtext.textContent = 'Open Netflix or Synora to use this extension.';
  }

  // 2. Room Connection Status
  if (status.roomInfo) {
    connectionPill.textContent = 'Connected';
    connectionPill.className = 'pill connected';
    displayRoomId.textContent = status.roomInfo.roomId;
    connectedState.classList.remove('hidden');
    disconnectedState.classList.add('hidden');
  } else {
    connectionPill.textContent = 'Disconnected';
    connectionPill.className = 'pill';
    connectedState.classList.add('hidden');
    disconnectedState.classList.remove('hidden');
  }
}

/**
 * Fetch current state from service worker
 */
function refreshStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' } as ExtensionMessage, (response) => {
    if (chrome.runtime.lastError) {
      siteInfoText.textContent = 'Service worker inactive';
      siteSubtext.textContent = 'Click to wake extension service worker.';
      return;
    }
    if (response && response.status) {
      renderStatus(response.status);
    }
  });
}

/**
 * Handle Room Connect
 */
connectBtn.addEventListener('click', () => {
  const code = roomInput.value.trim().toUpperCase();
  if (!code) {
    roomInput.focus();
    return;
  }

  chrome.runtime.sendMessage(
    { type: 'CONNECT_ROOM', roomId: code } as ExtensionMessage,
    (response) => {
      if (response && response.roomInfo) {
        roomInput.value = '';
        refreshStatus();
      }
    }
  );
});

roomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    connectBtn.click();
  }
});

/**
 * Handle Room Disconnect
 */
disconnectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'DISCONNECT_ROOM' } as ExtensionMessage, () => {
    refreshStatus();
  });
});

/**
 * Open Watch Party App in active browser
 */
openAppBtn.addEventListener('click', () => {
  const pwaUrl = 'https://ais-dev-t6rdhqad2flcdquh5qq332-86562896013.europe-west1.run.app/';
  chrome.tabs.create({ url: pwaUrl });
});

// Initial load
document.addEventListener('DOMContentLoaded', refreshStatus);
