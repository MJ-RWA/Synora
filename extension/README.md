# Synora Watch Party Bridge — Chrome Extension (Manifest V3)

Foundation browser extension that connects streaming playback (Netflix, etc.) to the Synora Watch Party application.

---

## Directory Structure

```
extension/
├── manifest.json              # Chrome Manifest V3 configuration
├── build.js                   # Standalone esbuild script for compiling extension
├── icons/                     # Extension icons (16, 32, 48, 128 px)
├── src/
│   ├── types/
│   │   ├── adapter.ts         # PlayerAdapter interface, PlaybackState, ContentIdentity
│   │   └── messages.ts        # Typed Chrome runtime & window postMessage protocols
│   ├── adapters/
│   │   ├── PlayerAdapter.ts   # BasePlayerAdapter abstract class
│   │   ├── NetflixAdapter.ts  # Netflix player detection stub (Phase 3 readiness)
│   │   └── Registry.ts        # Dynamic site adapter registry
│   ├── background/
│   │   └── service-worker.ts  # MV3 service worker managing state & message dispatching
│   ├── content/
│   │   └── index.ts           # Content script bridge for Netflix and Synora PWA
│   └── popup/
│       ├── popup.html         # Modern popup interface
│       ├── popup.css          # Dark emerald themed styling
│       └── popup.ts           # Popup controller
└── dist/                      # Fully compiled, self-contained unpacked extension
```

---

## Architecture

### 1. Minimal Permissions
The extension requests only minimal permissions:
- **`storage`**: Persists active watch party room connections and preferences locally.
- **`activeTab`**: Allows popup to check active tab status without broad browser access.
- **`host_permissions`**: Strictly scoped to Netflix and Synora Watch Party domains.
- **Forbidden permissions omitted**: No `<all_urls>`, no `cookies`, no `debugger`, no `webRequest`, no `webRequestBlocking`.

### 2. PlayerAdapter Abstraction
Standardized interface for streaming platforms:
- `isAvailable()`
- `getCurrentTime()`
- `getDuration()`
- `isPlaying()`
- `play()`
- `pause()`
- `seek(timeSeconds)`
- `getContentIdentity()`
- `subscribeToPlayback(callback)`

All playback control methods are ready for real-time synchronization implementation in Phase 3 without faking playback.

### 3. Bidirectional Messaging
- **Background Service Worker**: Coordinates connection state across tabs.
- **Content Script**: Injects into supported sites, listens for `window.postMessage` handshakes with the Synora web app, and detects Netflix player availability.
- **Popup UI**: Displays live site status, room connection status, and room connection actions.

---

## Build Command

To build the extension independently:

```bash
npm run build:extension
```

Output is emitted cleanly to `extension/dist/`.

---

## Chrome Installation & Testing Steps

1. Open Google Chrome or any Chromium browser (Edge, Brave).
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `extension/dist/` directory in this project.
6. The **Synora Watch Party Bridge** extension will appear in your installed extensions list.
7. Click the extension icon in your Chrome toolbar to open the popup:
   - On standard websites: shows **Unsupported Site**.
   - On `https://www.netflix.com/watch/...`: shows **Netflix Player Active**.
   - On the Synora Watch Party web app: shows **Synora Watch Party App**.
