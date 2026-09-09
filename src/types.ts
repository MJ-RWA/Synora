export interface User {
  uid: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  favorites?: string[];
  history?: string[];
  friends?: string[]; // Array of friend UIDs
  createdAt: string;
}

export interface NetflixRoomPlayback {
  status: 'playing' | 'paused';
  position: number;
  updatedAt: number;
  contentId: string;
  contentTitle?: string;
  rawUrl?: string;
  season?: number | null;
  episode?: number | null;
  hostId: string;
  hostName?: string;
}

export interface WatchRoom {
  id: string;
  title: string;
  videoUrl: string;
  currentTime: number;
  playing: boolean;
  hostId: string;
  ownerId?: string;
  hostName: string;
  createdAt: string;
  updatedAt?: number;
  subtitle?: string;
  usersCount: number;
  isActive: boolean;
  isPrivate?: boolean;
  inviteCode?: string;
  allowedUsers?: string[];
  isScreenSharing?: boolean;
  screenHostId?: string | null;
  movieId?: string | null;
  seriesId?: string | null;
  episodeId?: string | null;
  contentType?: string;
  contentId?: string | null;
  sourceType?: string;
  netflixPlayback?: NetflixRoomPlayback | null;
}

export interface WatchRoomMessage {
  id: string;
  text: string;
  username: string;
  timestamp: string;
}

export interface WatchRoomUser {
  id: string;
  username: string;
  isHost: boolean;
  joinedAt: string;
  speaking?: boolean;
  uid?: string | null;
}

export interface WatchRoomReaction {
  id: string;
  emoji: string;
  username: string;
  time: string;
}

export interface WatchRoomVoiceSignal {
  id: string;
  from: string;
  to: string;
  signal: string; // JSON stringified signal data
  type: 'offer' | 'answer' | 'candidate';
  time: string;
}

export interface FriendRequest {
  id: string;
  from: string; // UID
  fromUsername: string;
  to: string; // UID
  status: 'pending' | 'accepted' | 'rejected';
  time: string;
}

export interface Notification {
  id: string;
  toUser: string; // UID
  type: 'invite' | 'friend_request' | 'general';
  roomId?: string;
  message: string;
  read: boolean;
  time: string;
}
