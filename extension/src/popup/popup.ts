import { ExtensionMessage, ExtensionStatus, PlaybackState } from '../types/messages';

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

// Netflix card elements
const netflixPlayerPill = document.getElementById('netflixPlayerPill') as HTMLSpanElement;
const netflixInactiveBox = document.getElementById('netflixInactiveBox') as HTMLDivElement;
const netflixInactiveTitle = document.getElementById('netflixInactiveTitle') as HTMLDivElement;
const netflixInactiveSubtext = document.getElementById('netflixInactiveSubtext') as HTMLDivElement;
const openNetflixBtn = document.getElementById('openNetflixBtn') as HTMLButtonElement;

const netflixActiveBox = document.getElementById('netflixActiveBox') as HTMLDivElement;
const netflixMediaTitle = document.getElementById('netflixMediaTitle') as HTMLDivElement;
const netflixMediaId = document.getElementById('netflixMediaId') as HTMLDivElement;
const currentTimeDisplay = document.getElementById('currentTimeDisplay') as HTMLSpanElement;
const durationDisplay = document.getElementById('durationDisplay') as HTMLSpanElement;
const playbackProgressFill = document.getElementById('playbackProgressFill') as HTMLDivElement;
const netflixPlayBtn = document.getElementById('netflixPlayBtn') as HTMLButtonElement;
const netflixPauseBtn = document.getElementById('netflixPauseBtn') as HTMLButtonElement;
const netflixSeekBackBtn = document.getElementById('netflixSeekBackBtn') as HTMLButtonElement;
const netflixSeekForwardBtn = document.getElementById('netflixSeekForwardBtn') as HTMLButtonElement;
const diagFeedback = document.getElementById('diagFeedback') as HTMLDivElement;

let currentPlaybackState: PlaybackState | null = null;
let pollTimer: number | null = null;

function formatSeconds(secs: number): string {
  if (!isFinite(secs) || isNaN(secs) || secs < 0) return '00:00';
  const total = Math.floor(secs);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

function setFeedback(msg: string, isError = false) {
  diagFeedback.textContent = msg;
  diagFeedback.style.color = isError ? '#f87171' : '#34d399';
  setTimeout(() => {
    if (diagFeedback.textContent === msg) {
      diagFeedback.style.color = '#9ca3af';
    }
  }, 3000);
}

/**
 * Render extension status onto the popup UI
 */
function renderStatus(status: ExtensionStatus) {
  // 1. Site Status
  if (status.currentSite === 'netflix') {
    siteStatusDot.className = 'status-indicator active';
    if (status.playerAvailable) {
      siteInfoText.textContent = 'Netflix Player Active';
      siteSubtext.textContent = 'Playback monitor and controls connected.';
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

  // 2. Netflix Playback Section
  const netflix = status.netflix;
  if (netflix?.tabFound) {
    if (netflix.isWatchPage && netflix.state) {
      currentPlaybackState = netflix.state;
      netflixInactiveBox.classList.add('hidden');
      netflixActiveBox.classList.remove('hidden');

      if (netflix.state.isBuffering) {
        netflixPlayerPill.textContent = 'Buffering';
        netflixPlayerPill.className = 'pill warning';
      } else if (netflix.state.isPlaying) {
        netflixPlayerPill.textContent = 'Playing';
        netflixPlayerPill.className = 'pill active';
      } else {
        netflixPlayerPill.textContent = 'Paused';
        netflixPlayerPill.className = 'pill';
      }

      netflixMediaTitle.textContent = netflix.content?.title || 'Netflix Video';
      netflixMediaId.textContent = `ID: ${netflix.content?.id || 'Unknown'}${
        netflix.content?.season ? ` • S${netflix.content.season}` : ''
      }${netflix.content?.episode ? `E${netflix.content.episode}` : ''}`;

      currentTimeDisplay.textContent = formatSeconds(netflix.state.currentTime);
      durationDisplay.textContent = formatSeconds(netflix.state.duration);

      const percent =
        netflix.state.duration > 0
          ? Math.min(100, Math.max(0, (netflix.state.currentTime / netflix.state.duration) * 100))
          : 0;
      playbackProgressFill.style.width = `${percent}%`;

      netflixPlayBtn.disabled = netflix.state.isPlaying;
      netflixPauseBtn.disabled = !netflix.state.isPlaying;
    } else if (netflix.isWatchPage) {
      netflixPlayerPill.textContent = 'Loading...';
      netflixPlayerPill.className = 'pill warning';
      netflixInactiveBox.classList.remove('hidden');
      netflixActiveBox.classList.add('hidden');
      netflixInactiveTitle.textContent = 'Netflix Player Loading...';
      netflixInactiveSubtext.textContent = 'Waiting for active video element in Netflix tab.';
      openNetflixBtn.classList.add('hidden');
    } else {
      netflixPlayerPill.textContent = 'Browse';
      netflixPlayerPill.className = 'pill';
      netflixInactiveBox.classList.remove('hidden');
      netflixActiveBox.classList.add('hidden');
      netflixInactiveTitle.textContent = 'Netflix Open (Browse Mode)';
      netflixInactiveSubtext.textContent = 'Start playing a title on Netflix to monitor playback.';
      openNetflixBtn.classList.remove('hidden');
      openNetflixBtn.textContent = 'Switch to Netflix ↗';
    }
  } else {
    netflixPlayerPill.textContent = 'Inactive';
    netflixPlayerPill.className = 'pill';
    netflixInactiveBox.classList.remove('hidden');
    netflixActiveBox.classList.add('hidden');
    netflixInactiveTitle.textContent = 'No Netflix Tab Detected';
    netflixInactiveSubtext.textContent = 'Open Netflix in your browser to monitor playback.';
    openNetflixBtn.classList.remove('hidden');
    openNetflixBtn.textContent = 'Open Netflix ↗';
  }

  // 3. Room Connection Status
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
 * Playback Controls
 */
netflixPlayBtn.addEventListener('click', () => {
  setFeedback('Sending play command...');
  chrome.runtime.sendMessage(
    { type: 'CONTROL_PLAYBACK', action: 'play' } as ExtensionMessage,
    (res: { ok?: boolean; error?: string }) => {
      if (res && res.ok) {
        setFeedback('Play command executed.');
        refreshStatus();
      } else {
        setFeedback(`Play failed: ${res?.error || 'Unknown error'}`, true);
      }
    }
  );
});

netflixPauseBtn.addEventListener('click', () => {
  setFeedback('Sending pause command...');
  chrome.runtime.sendMessage(
    { type: 'CONTROL_PLAYBACK', action: 'pause' } as ExtensionMessage,
    (res: { ok?: boolean; error?: string }) => {
      if (res && res.ok) {
        setFeedback('Pause command executed.');
        refreshStatus();
      } else {
        setFeedback(`Pause failed: ${res?.error || 'Unknown error'}`, true);
      }
    }
  );
});

netflixSeekBackBtn.addEventListener('click', () => {
  const current = currentPlaybackState?.currentTime || 0;
  const target = Math.max(0, current - 10);
  setFeedback(`Seeking to ${formatSeconds(target)}...`);
  chrome.runtime.sendMessage(
    { type: 'CONTROL_PLAYBACK', action: 'seek', time: target } as ExtensionMessage,
    (res: { ok?: boolean; error?: string }) => {
      if (res && res.ok) {
        setFeedback(`Seek to ${formatSeconds(target)} executed.`);
        refreshStatus();
      } else {
        setFeedback(`Seek failed: ${res?.error || 'Rejected by player'}`, true);
      }
    }
  );
});

netflixSeekForwardBtn.addEventListener('click', () => {
  const current = currentPlaybackState?.currentTime || 0;
  const duration = currentPlaybackState?.duration || 0;
  const target = duration > 0 ? Math.min(duration, current + 10) : current + 10;
  setFeedback(`Seeking to ${formatSeconds(target)}...`);
  chrome.runtime.sendMessage(
    { type: 'CONTROL_PLAYBACK', action: 'seek', time: target } as ExtensionMessage,
    (res: { ok?: boolean; error?: string }) => {
      if (res && res.ok) {
        setFeedback(`Seek to ${formatSeconds(target)} executed.`);
        refreshStatus();
      } else {
        setFeedback(`Seek failed: ${res?.error || 'Rejected by player'}`, true);
      }
    }
  );
});

openNetflixBtn.addEventListener('click', () => {
  chrome.tabs.query({ url: '*://*.netflix.com/*' }, (tabs) => {
    if (tabs.length > 0 && tabs[0].id) {
      chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      chrome.tabs.create({ url: 'https://www.netflix.com/' });
    }
  });
});

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

// Periodic refresh while popup is visible (every 1s)
document.addEventListener('DOMContentLoaded', () => {
  refreshStatus();
  pollTimer = window.setInterval(refreshStatus, 1000);
});

window.addEventListener('unload', () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
