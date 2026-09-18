export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  unlockedAt?: string;
}

export interface User {
  uid: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  bio?: string;
  status?: 'online' | 'away' | 'watching' | 'offline';
  customStatus?: string;
  avatarUrl?: string;
  totalWatchSeconds?: number;
  partiesJoined?: number;
  partiesHosted?: number;
  badges?: string[]; // Array of badge IDs
  blockedUsers?: string[]; // Array of blocked UIDs
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
  isCameraActive?: boolean;
  cameraHostId?: string | null;
  movieId?: string | null;
  seriesId?: string | null;
  episodeId?: string | null;
  contentType?: string;
  contentId?: string | null;
  sourceType?: string;
  isLiveParty?: boolean;
  isLiveStreaming?: boolean;
  netflixPlayback?: NetflixRoomPlayback | null;
  videoEnded?: boolean;
}

export interface WatchRoomMessage {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  userId?: string | null;
  isHost?: boolean;
}

export interface WatchRoomUser {
  id: string;
  username: string;
  isHost: boolean;
  joinedAt: string;
  speaking?: boolean;
  uid?: string | null;
  mutedByHost?: boolean;
  micActive?: boolean;
  watchTimeSeconds?: number;
  status?: 'watching' | 'away' | 'idle' | 'online' | 'offline';
  avatarUrl?: string;
  customStatus?: string;
  lastSeen?: number | string;
  connectionStatus?: 'online' | 'offline';
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
