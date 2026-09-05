import { ContentIdentity, PlaybackState } from './adapter';

export type SiteType = 'netflix' | 'watchparty' | 'unsupported';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RoomConnectionInfo {
  roomId: string;
  roomTitle?: string;
  isHost?: boolean;
  connectedAt?: number;
}

export interface ExtensionStatus {
  version: string;
  currentSite: SiteType;
  siteUrl: string;
  siteSupported: boolean;
  playerAvailable: boolean;
  connectionState: ConnectionState;
  roomInfo: RoomConnectionInfo | null;
  lastError: string | null;
}

/**
 * Internal Chrome Runtime messages (Background <-> Content <-> Popup)
 */
export type ExtensionMessage =
  | { type: 'PING' }
  | { type: 'PONG'; status: ExtensionStatus }
  | { type: 'GET_STATUS' }
  | { type: 'STATUS_RESPONSE'; status: ExtensionStatus }
  | { type: 'CHECK_SITE_SUPPORT'; url: string }
  | { type: 'SITE_SUPPORT_RESULT'; site: SiteType; supported: boolean; playerAvailable: boolean }
  | { type: 'CONNECT_ROOM'; roomId: string }
  | { type: 'DISCONNECT_ROOM' }
  | { type: 'ROOM_STATE_UPDATED'; roomInfo: RoomConnectionInfo | null }
  | { type: 'CONTENT_IDENTIFIED'; content: ContentIdentity }
  | { type: 'PLAYBACK_STATE_CHANGED'; state: PlaybackState };

/**
 * Message protocol for communication between Watch Party Web App (PWA)
 * and the extension content script via window.postMessage
 */
export const SYNORA_PWA_MESSAGE_SOURCE = 'SYNORA_WATCH_PARTY_PWA';
export const SYNORA_EXTENSION_MESSAGE_SOURCE = 'SYNORA_EXTENSION';

export interface SynoraPwaHandshakeRequest {
  source: typeof SYNORA_PWA_MESSAGE_SOURCE;
  type: 'SYNORA_HANDSHAKE_REQUEST';
  payload?: {
    appVersion?: string;
    roomId?: string;
  };
}

export interface SynoraExtensionHandshakeResponse {
  source: typeof SYNORA_EXTENSION_MESSAGE_SOURCE;
  type: 'SYNORA_HANDSHAKE_RESPONSE';
  payload: {
    extensionVersion: string;
    extensionAvailable: boolean;
    connectedRoomId: string | null;
  };
}

export interface SynoraPwaRoomJoin {
  source: typeof SYNORA_PWA_MESSAGE_SOURCE;
  type: 'SYNORA_ROOM_JOIN';
  payload: {
    roomId: string;
    roomTitle?: string;
    isHost: boolean;
  };
}

export interface SynoraPwaRoomLeave {
  source: typeof SYNORA_PWA_MESSAGE_SOURCE;
  type: 'SYNORA_ROOM_LEAVE';
  payload?: {
    roomId?: string;
  };
}

export type SynoraBridgeMessage =
  | SynoraPwaHandshakeRequest
  | SynoraExtensionHandshakeResponse
  | SynoraPwaRoomJoin
  | SynoraPwaRoomLeave;
