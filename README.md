# Synora

> **Watch together. Talk together.**

Synora is an open-source, real-time social Watch Party platform designed to let friends and communities experience supported video content together with host-synchronized playback, live text chat, floating emoji reactions, crystal-clear WebRTC voice chat, and live screen sharing.

Synora is **not** a traditional streaming service and does not host or distribute copyrighted media. Instead, it provides the real-time social coordination, peer-to-peer audio, and playback synchronization layer that turns individual viewing into a shared cinematic gathering.

---

## Table of Contents

- [Overview](#overview)
- [Current Feature Inventory](#current-feature-inventory)
- [How to Use Synora (Step-by-Step Walkthrough)](#how-to-use-synora-step-by-step-walkthrough)
- [Private Watch Parties & Access Control](#private-watch-parties--access-control)
- [Watching YouTube Content](#watching-youtube-content)
- [Netflix Watch Parties & Browser Extension](#netflix-watch-parties--browser-extension)
- [Installing the Browser Extension](#installing-the-browser-extension)
- [Voice Chat (WebRTC)](#voice-chat-webrtc)
- [Screen Sharing](#screen-sharing)
- [Live Chat & Floating Reactions](#live-chat--floating-reactions)
- [User Profile](#user-profile)
- [Future Social Features (Roadmap)](#future-social-features-roadmap)
- [Architecture](#architecture)
- [Local Development Setup](#local-development-setup)
- [Firebase Configuration](#firebase-configuration)
- [Troubleshooting](#troubleshooting)
- [Security & Privacy](#security--privacy)
- [Project Structure](#project-structure)
- [License](#license)

---

## Overview

Traditional co-watching often suffers from awkward countdowns ("3, 2, 1, press play!"), drift between participants, disconnected third-party voice calls, and complicated setup.

Synora solves this by providing:
1. **Host-Authoritative Player Synchronization**: The host's play, pause, and seek actions automatically keep everyone in lockstep.
2. **Integrated Social Controls**: Voice chat, instant text chat, and floating emoji reactions appear right alongside the video without third-party apps.
3. **Multiple Supported Content Sources**: Curated public domain sample media, direct custom video URLs (`.mp4`, `.m3u8` HLS), embedded YouTube videos, live screen sharing, and an experimental Chrome extension bridge for Netflix.

---

## Current Feature Inventory

Based on an audit of the current codebase, here is the exact feature status:

### Watch Parties
- **Create Watch Party**: Create public or private rooms with custom titles and selectable video sources.
- **Join Watch Party**: Enter via unique room code, direct URL, or room browser on the homepage.
- **Persistent Rooms**: Watch parties are saved in Firestore (`watchRooms`) and persist across browser refreshes until the host chooses to delete or end the room.
- **Access Control (Private vs. Public)**:
  - **Public Rooms**: Listed on the homepage for anyone to discover and join.
  - **Private Rooms**: Unlisted, protected by a secure 12-character invite code (`?code=...`) or allowed-user UID list.
- **Host Controls**: Host can play, pause, seek, manually broadcast timestamp resync, mute participants, and permanently delete or end the room.
- **Sync with Host**: Participants have a dedicated "Sync with Host" button to instantly snap back into alignment if local network latency causes drift.

### Real-Time Interaction
- **Live Text Chat**: Real-time room messages powered by Firestore subcollections with timestamps and sender identifiers.
- **Floating Emoji Reactions**: Interactive reaction buttons (❤️, 😂, 😮, 🔥, 👏, 🎉) that float animated emoji particles across the video viewport for all participants in real time.
- **WebRTC Voice Chat**: Direct peer-to-peer mesh audio powered by standard WebRTC with speaking indicators, individual volume controls, and instant mic mute/unmute.
- **Live Screen Sharing**: Built-in browser display capture (`navigator.mediaDevices.getDisplayMedia`) allowing hosts or participants to stream browser tabs, desktop windows, or games directly to the room.
- **Active Participant Presence**: Real-time list of online participants with host badges and mute state indicators.

### Media & Playback
- **Curated Open Media**: Includes public domain open-source films (*Big Buck Bunny*, *Tears of Steel*, *Sintel*, *Elephant's Dream*) with multi-language WebVTT subtitles.
- **Direct Video Streams**: Supports custom direct `.mp4` video files and `.m3u8` HLS streaming via `hls.js`.
- **YouTube Playback (`YouTubeSyncPlayer`)**: Embedded player utilizing the YouTube IFrame Player API. Host play/pause/seek controls synchronize across all participants with automatic latency compensation.
- **Live Screen Stream**: Stream any local application or screen window as the primary video source.

### Browser Extension (Experimental)
- **Synora Watch Party Bridge (Manifest V3)**: Chrome extension that bridges Netflix video playback state (`currentTime`, `isPlaying`) with Synora rooms via `window.postMessage`.
- **Privacy-Preserving**: Does **not** proxy video, does **not** collect passwords, cookies, or DRM keys. Each user watches through their own authorized Netflix account.

### Authentication & Account
- **Google Sign-In**: Powered by Firebase Authentication for room hosts.
- **Guest Access**: Participants can join rooms as guests simply by providing a display nickname.
- **User Profile**: Profile page (`/profile`) showing user name, email, verified badge, and sign-out action.

### Progressive Web App (PWA)
- **Installable PWA**: Configured with `vite-plugin-pwa`, custom Web App Manifest, offline service worker, and in-app install buttons.

---

## How to Use Synora (Step-by-Step Walkthrough)

### Step 1 — Sign In (or Join as Guest)
- **To Host a Watch Party**: Click **Sign In** in the top navigation bar. Sign in using your Google account via Firebase Auth.
- **To Join an Existing Party**: Signing in is optional. You can enter any public or invited room by entering a display nickname.

### Step 2 — Create a Watch Party
1. On the Synora homepage, click **Create a Watch Party** (or **New Party** in the navigation bar).
2. Enter your **Host Nickname** and a descriptive **Party Title**.
3. Choose your privacy preference:
   - **Public Room**: Discoverable in the "Active Watch Parties" section on the homepage.
   - **Private (Invite-Only)**: Hidden from the homepage list; only accessible via your unique invite link.

### Step 3 — Select Your Content Source
Inside the creation modal, choose one of the five supported content options:
- **Sample Film**: Pick from high-quality public domain films with subtitles.
- **Custom URL**: Enter a direct link to an `.mp4` file or an `.m3u8` HLS stream.
- **YouTube / Embed**: Paste any standard YouTube link (e.g., `https://www.youtube.com/watch?v=...` or `https://youtu.be/...`).
- **Live Screen Share**: Host a room where your computer's screen, browser tab, or application window is the stream.
- **Netflix (Experimental)**: Connect via the Synora Browser Extension and paste a Netflix watch URL.

Click **Create Watch Party**. You are redirected to your dedicated room (`/watchparty/:roomId`).

### Step 4 — Invite Friends
1. Inside the room, click the **Share / Copy Invite Link** button in the header.
2. The invite link format is:
   `https://<your-app-url>/watchparty/<roomId>?code=<inviteCode>`
3. Send this link to your friends via your favorite messaging app.

### Step 5 — Enter the Watch Party
When guests open the invite link:
- If the room is public, they enter directly and enter their nickname.
- If the room is private, the link automatically validates the invite code in the URL. If someone visits without the invite code, they are prompted to enter the code or request access.

### Step 6 — Synchronized Playback
- **Host Controls**: The host's playback controls (Play, Pause, Scrub/Seek bar) broadcast new timestamps and play states to Firestore.
- **Guest Alignment**: Guest players continuously align with the host's timeline. If a participant experiences buffering or network lag, they can click the **Sync with Host** button to immediately snap back to the host's timestamp.

### Step 7 — Social Interaction
- **Chat**: Type in the real-time chat box on the right (or toggle the chat drawer on mobile).
- **Reactions**: Click any floating emoji reaction (❤️, 😂, 😮, 🔥, 👏, 🎉) at the bottom of the video player to launch animated reaction fireworks across everyone's screens.
- **Voice Chat**: Click the microphone icon to connect to peer-to-peer WebRTC voice chat. Grant microphone permissions in your browser. Use the mute/unmute toggle as needed.
- **Screen Sharing**: Click **Share Screen** to broadcast your desktop or a browser tab to other room members.

### Step 8 — Leaving vs. Ending a Room
- **Leave Room**: Click the exit button. This safely removes your presence and disconnects your voice/chat streams. The room remains active in Firestore, allowing the host or remaining guests to return anytime.
- **End / Delete Room (Host Only)**: The host can click the **Delete Room** trash icon on the homepage or in room settings. This permanently deletes the Firestore room document, chat messages, and invite links.

---

## Private Watch Parties & Access Control

Synora provides built-in privacy controls for groups who want invite-only viewing sessions:

- **Invite Code Tokenization**: When creating a private room, Synora generates a cryptographically random invite code stored in `watchRooms/{roomId}.inviteCode`.
- **Link Sharing**: The invite link includes the token in the URL query parameter (`?code=...`). When participants click the link, Synora validates the token and grants access.
- **Unauthorized Visitors**: If a user navigates to `/watchparty/:roomId` without the valid invite code, Synora presents an access gate requiring the user to supply the room code.
- **Host Persistence**: Rooms created by authenticated users are linked to their `hostId` in Firestore. Even after leaving the room, the host can find and resume their parties under **My Watch Parties** on the homepage.

---

## Watching YouTube Content

Synora includes native support for YouTube co-watching via the `YouTubeSyncPlayer` component:

### Supported URL Formats
- Standard watch URLs: `https://www.youtube.com/watch?v=VIDEO_ID`
- Shortened URLs: `https://youtu.be/VIDEO_ID`
- Embed URLs: `https://www.youtube.com/embed/VIDEO_ID`

### How It Works
1. When a YouTube URL is entered, Synora extracts the 11-character video ID.
2. The room initializes the official **YouTube IFrame Player API** (`window.YT.Player`).
3. When the host plays, pauses, or seeks, Synora writes the timestamp and status to the room's Firestore record.
4. Participants' YouTube players receive the updates and call `seekTo()`, `playVideo()`, or `pauseVideo()`.
5. If a participant's local playback drifts by more than 2 seconds from the host, the player automatically performs a soft-seek drift correction.

> **Note**: Synora does **not** download, re-encode, or proxy YouTube videos. Content is streamed directly from YouTube to each user's browser in accordance with YouTube's Terms of Service.

---

## Netflix Watch Parties & Browser Extension

> **Status: Experimental / Developer Preview**

Synora includes an experimental integration for Netflix watch parties using a lightweight companion browser extension.

### Core Architecture & Privacy Principles
- **No Password Collection**: Synora **never** asks for, stores, or transmits your Netflix email, password, or account credentials.
- **No Cookie or DRM Access**: Synora **never** accesses authentication cookies or protected DRM decryption keys.
- **No Video Proxying**: Synora does **not** stream, host, or relay Netflix video through its servers.
- **Individual Subscriptions**: Every participant must be logged into their own active Netflix account in their own browser.
- **Playback Synchronization Only**: The extension communicates strictly with the local HTML5 `<video>` element on `netflix.com/watch/*`, reading and setting `currentTime` and `paused`/`playing` state.

### How to Use Netflix with Synora
1. Build and install the Synora extension (see instructions below).
2. Open Synora in your browser and sign in.
3. Open Netflix in another browser tab and sign into your Netflix account.
4. Navigate to the Netflix title you want to watch.
5. In Synora, click **Create Watch Party** → select **Netflix** (or paste the Netflix watch URL).
6. Invite your friends. Each friend must also have the extension installed and Netflix open.
7. Play, pause, or seek on Netflix or through the Synora player companion—the extension keeps everyone in sync!

---

## Installing the Browser Extension

The companion extension source code is located in the `/extension` directory of this repository. Because the extension is currently in developer preview, it is not yet distributed through the Chrome Web Store.

### Building the Extension
From the root of the Synora repository, run:

```bash
npm run build:extension
```

This compiles the background service worker, content scripts, and assets into the `extension/dist/` directory.

### Loading Unpacked into Google Chrome (or Chromium-based browsers)
1. Open Google Chrome (or Brave / Edge).
2. Navigate to `chrome://extensions/`.
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. Click **Load unpacked** in the top-left corner.
5. Select the `extension/dist/` folder from the Synora repository.
6. The **Synora Watch Party Bridge** extension icon will now appear in your browser toolbar.

### Verifying the Connection
1. Open the Synora web application.
2. In the bottom-right corner, look for the floating **Synora Bridge** diagnostics widget.
3. Click the widget to verify:
   - Extension version status (e.g., `v1.0.0`)
   - Bridge communication state
   - Active Netflix player detection

---

## Voice Chat (WebRTC)

Synora provides built-in, low-latency audio conferencing directly in the watch room:

- **Peer-to-Peer Mesh**: Uses browser-native WebRTC `RTCPeerConnection` with standard Google STUN servers (`stun:stun.l.google.com:19302`) for peer discovery.
- **Permissions**: When joining voice chat, your browser will request microphone permission.
- **Controls**:
  - **Mute / Unmute**: Toggle your microphone on and off instantly.
  - **Speaking Indicators**: Animated glowing audio rings indicate who is currently speaking.
  - **Host Moderation**: Room hosts can mute participants if needed.
- **Troubleshooting**: If audio fails to connect, check that your browser has microphone permissions enabled and that no other application has locked exclusive microphone access.

---

## Screen Sharing

Host a watch party where your desktop screen, a specific window, or a browser tab is the main attraction:

1. Inside a watch party, click **Share Screen**.
2. Your browser will open the standard screen selection dialog (`navigator.mediaDevices.getDisplayMedia`).
3. Choose to share your **Entire Screen**, **Window**, or **Chrome Tab** (ensure "Share audio" is checked if you want system/tab sound).
4. Participants in the room receive the WebRTC video stream in place of the default video player.
5. Click **Stop Sharing** at any time to return to normal room playback.

---

## Live Chat & Floating Reactions

- **Real-Time Text Chat**: Room messages are written to `watchRooms/{roomId}/messages` in Firestore and synced with real-time listeners (`onSnapshot`). Messages display sender names, host badges, and timestamps.
- **Floating Emoji Reactions**: Participants can click reaction icons (❤️, 😂, 😮, 🔥, 👏, 🎉). Each click generates a particle effect rendered across the video frame for all room members, creating an engaging live audience atmosphere.

---

## User Profile

The current profile implementation is located at `/profile`:
- Displays authenticated user's display name and email address.
- Displays account verification status badge.
- Displays membership date.
- Provides a direct **Sign Out** button that clears Firebase Auth tokens.

---

## Future Social Features (Roadmap)

To maintain clarity and transparency, the following features are **planned** for future releases and are **not** yet fully implemented in the current production build:

- **User Friend System**: Full friend search, friend requests, mutual friend lists, and presence indicators. *(An early preview is accessible at `/friends`)*.
- **Watch Hours & Statistics**: Lifetime watch-time counters, favorite genres, and co-watching milestones.
- **Social Activity Feed**: Updates showing what movies or videos your friends watched recently.
- **Achievements & Badges**: Unlockable trophies for hosting parties, inviting friends, and watching community events.
- **Watch Streaks**: Daily and weekly watch-streak tracking with friends.
- **Direct 1-on-1 Messaging**: Private chat between friends outside of active watch party rooms.
- **Advanced Room Moderation**: Kick, ban, co-host delegation, and password-protected rooms.

---

## Architecture

Synora separates state synchronization from media transmission for optimal performance and privacy:

```
+-------------------------------------------------------------+
|                     Synora Web Application                  |
|                    (React + Vite + Tailwind)                |
+------------------------------+------------------------------+
                               |
            +------------------+------------------+
            |                                     |
            v                                     v
+-----------------------+             +-----------------------+
|  Firebase Firestore   |             |     WebRTC Engine     |
|   & Authentication    |             |    (Peer Connections) |
+-----------------------+             +-----------------------+
| - Room Metadata       |             | - P2P Mesh Voice Chat |
| - Host Playback State |             | - Live Screen Sharing |
| - Live Room Messages  |             | - Audio Indicators    |
| - Emoji Reactions     |             +-----------------------+
+-----------------------+
            ^
            | (Playback state via window.postMessage)
+-----------------------+
| Synora Chrome Bridge  | <--->  [ Netflix.com HTML5 Video ]
| (Manifest V3 Ext.)    |        (User's own authorized tab)
+-----------------------+
```

### Key Architectural Highlights:
1. **Firestore for State**: Firestore handles room discovery, participant presence, and playback timestamps. It does **not** handle heavy video streams.
2. **WebRTC for Direct Media**: Voice chat and screen sharing flow directly between browser peers via WebRTC, ensuring zero server storage of audio or screen capture.
3. **No DRM or Media Proxying**: Streaming content (YouTube, Netflix, HLS) loads directly on each participant's browser from the authorized origin.

---

## Local Development Setup

### Prerequisites
- **Node.js**: Version 18.x or higher (Node 20+ recommended)
- **npm**: Version 9.x or higher

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/synora.git
cd synora
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure your `.env` contains the required configuration:

```env
# Required for Google AI Studio / Gemini integrations
GEMINI_API_KEY="your-gemini-api-key"

# Base URL of the running application
APP_URL="http://localhost:3000"

# Optional Bunny.net credentials (if using hosted storage)
BUNNY_API_KEY=""
```

> **Security Warning**: Never commit sensitive private API keys or service account credentials to version control.

### 4. Firebase Configuration
Synora reads client Firebase credentials from `firebase-applet-config.json` in the root directory. A standard configuration includes:

```json
{
  "apiKey": "YOUR_FIREBASE_API_KEY",
  "authDomain": "YOUR_FIREBASE_AUTH_DOMAIN",
  "projectId": "YOUR_FIREBASE_PROJECT_ID",
  "storageBucket": "YOUR_FIREBASE_STORAGE_BUCKET",
  "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
  "appId": "YOUR_FIREBASE_APP_ID",
  "firestoreDatabaseId": "(default)"
}
```

### 5. Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express + Vite development server on `http://localhost:3000` |
| `npm run build` | Builds the Vite frontend and bundles the Express server with esbuild |
| `npm run start` | Runs the compiled production server (`dist/server.cjs`) |
| `npm run preview` | Previews the Vite production build locally |
| `npm run lint` | Runs ESLint across the codebase |
| `npm run build:extension` | Builds the Chrome extension into `extension/dist/` |
| `npm run clean` | Removes the `dist/` build directory |

---

## Troubleshooting

### 1. Watch Party Link Returns 404 or "Room Not Found"
- **Cause**: The room ID in the URL may have been misspelled, or the host may have deleted the room.
- **Resolution**: Check the URL carefully. If the room was private, make sure the `?code=...` query parameter is attached.

### 2. Video Does Not Play or Keeps Buffering
- **Direct URLs**: Ensure custom video URLs end in `.mp4` or `.m3u8` and have valid CORS (`Access-Control-Allow-Origin: *`) headers enabled.
- **YouTube**: Some YouTube videos disable third-party embedding. Verify the video can be embedded by testing the link directly in YouTube.

### 3. Netflix Extension Shows "Disconnected"
- **Cause**: The extension content script may not have injected yet, or Netflix is not currently open in a tab.
- **Resolution**:
  1. Make sure the extension is loaded under `chrome://extensions/`.
  2. Open Netflix (`https://www.netflix.com/watch/...`) in another tab.
  3. Refresh the Synora room tab.
  4. Open the floating diagnostics widget at the bottom right to verify connection status.

### 4. Microphone / Voice Chat Issues
- **Cause**: Browser microphone permissions blocked, or another app has exclusive audio capture.
- **Resolution**:
  1. Click the lock or tune icon in your browser address bar.
  2. Set **Microphone** permission to **Allow**.
  3. Ensure your default input device in system settings is set to your active microphone.

### 5. Screen Sharing Fails to Start
- **Cause**: Permission denied or unsupported browser/device.
- **Resolution**: Screen capture requires a desktop browser (Chrome, Edge, Firefox). Ensure you grant permissions in the browser pop-up prompt.

---

## Security & Privacy

- **No Content Piracy**: Synora does not host, decrypt, download, or re-transmit copyrighted video content.
- **Authentication**: User authentication is securely managed via Google Firebase Authentication.
- **Firestore Security Rules**: Database rules enforce that only room hosts can delete rooms, and participants can only post messages to rooms they are currently members of.
- **WebRTC Privacy**: Voice chat and screen sharing streams are direct peer-to-peer WebRTC connections. No audio or video data is recorded or stored on any server.
- **Extension Permissions**: The Synora extension requests minimal permissions (`activeTab`, `storage`, `tabs`) strictly necessary to communicate with active Netflix watch tabs and the Synora web domain.

---

## Project Structure

```
synora/
├── extension/                  # Chrome Extension (Manifest V3)
│   ├── manifest.json           # Extension configuration & permissions
│   ├── build.js                # Extension esbuild packaging script
│   └── src/
│       ├── background/         # Extension service worker
│       ├── content/            # Injected content scripts
│       └── adapters/           # Streaming site adapters (Netflix)
├── src/                        # Synora React Application
│   ├── components/             # Reusable UI components
│   │   ├── Navbar.tsx          # Navigation bar
│   │   ├── VideoPlayer.tsx     # Direct MP4 / HLS video player
│   │   ├── YouTubeSyncPlayer.tsx # YouTube IFrame API sync player
│   │   ├── WatchPartyModal.tsx # Room creation modal
│   │   ├── JoinPartyModal.tsx  # Join room modal
│   │   ├── NetflixExtensionDiagnostics.tsx # Extension status tool
│   │   ├── VoiceChat.tsx       # WebRTC voice controls
│   │   ├── ScreenShare.tsx     # Display capture component
│   │   └── Chat.tsx            # Real-time room chat
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts          # Firebase Authentication hook
│   │   ├── useExtensionBridge.ts # Extension communication hook
│   │   ├── usePWAInstall.ts    # PWA install prompt hook
│   │   └── useOnlineStatus.ts  # Network offline detection hook
│   ├── pages/                  # Top-level view routes
│   │   ├── Home.tsx            # Homepage with onboarding & discovery
│   │   ├── WatchParty.tsx      # Main Watch Party room view
│   │   ├── Friends.tsx         # Friends preview page
│   │   ├── Profile.tsx         # User profile page
│   │   └── Support.tsx         # Community support page
│   ├── firebase.ts             # Firebase client initialization
│   ├── types.ts                # TypeScript type definitions
│   └── App.tsx                 # React router route declarations
├── server.ts                   # Express server with Vite middleware
├── package.json                # Dependencies and npm scripts
├── vite.config.ts              # Vite configuration
└── metadata.json               # Platform capabilities & frame permissions
```

---

## Roadmap

### Available Now
- [x] Host-synchronized playback for custom video URLs and sample media
- [x] YouTube co-watching with embedded YouTube Player API
- [x] WebRTC peer-to-peer voice chat with speaking indicators
- [x] WebRTC live screen sharing (tabs, windows, full screen)
- [x] Real-time text chat and animated floating emoji reactions
- [x] Public and private (invite-only) rooms with persistent URLs
- [x] Progressive Web App (PWA) installation
- [x] Experimental Netflix extension bridge

### In Progress / Experimental
- [ ] Netflix extension auto-pairing and multi-provider extension expansion
- [ ] Friend management and real-time watch invitations preview (`/friends`)

### Planned (Future Releases)
- [ ] User watch-hour tracking and watch stats
- [ ] Profile achievements, badges, and watch streaks
- [ ] Activity feeds and movie recommendations
- [ ] 1-on-1 direct messaging
- [ ] Granular room moderation tools (co-hosts, participant kick/ban)

---

## License

Synora is open source software built for community viewing. Please see the [Terms of Service](/terms) and [DMCA Guidelines](/dmca) for legal guidelines.
