import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WatchRoomUser } from '../types';

export const HEARTBEAT_INTERVAL_MS = 20000; // 20 seconds
export const HEARTBEAT_TIMEOUT_MS = 50000;  // 50 seconds timeout

// In-memory throttle tracker to protect Firestore from redundant writes under load
const lastHeartbeatSent: Record<string, number> = {};
const lastOfflineSent: Record<string, number> = {};

/**
 * Checks if a room participant is currently LIVE / actively watching.
 * A user is considered LIVE only if:
 * 1. Their connectionStatus is not 'offline'
 * 2. Their heartbeat (lastSeen or joinedAt) is within the timeout window.
 */
export function isUserLive(
  user: WatchRoomUser | null | undefined, 
  now: number = Date.now(), 
  timeoutMs: number = HEARTBEAT_TIMEOUT_MS
): boolean {
  if (!user) return false;
  if (user.connectionStatus === 'offline') return false;

  let lastSeenMs: number;
  if (typeof user.lastSeen === 'number') {
    lastSeenMs = user.lastSeen;
  } else if (user.lastSeen && typeof user.lastSeen === 'object' && 'toMillis' in user.lastSeen && typeof user.lastSeen.toMillis === 'function') {
    lastSeenMs = user.lastSeen.toMillis();
  } else if (typeof user.lastSeen === 'string') {
    lastSeenMs = new Date(user.lastSeen).getTime();
  } else if (user.joinedAt) {
    lastSeenMs = new Date(user.joinedAt).getTime();
  } else {
    return false;
  }

  if (isNaN(lastSeenMs)) return false;
  return (now - lastSeenMs) <= timeoutMs;
}

/**
 * Sends a periodic heartbeat to Firestore to refresh the user's presence.
 * Throttled to at most once per 10s per user per room to prevent write amplification.
 */
export async function sendHeartbeat(
  roomId: string,
  userId: string,
  extra: Partial<WatchRoomUser> = {},
  force: boolean = false
): Promise<void> {
  if (!roomId || !userId) return;
  const key = `${roomId}:${userId}`;
  const now = Date.now();
  const lastTime = lastHeartbeatSent[key] || 0;

  if (!force && (now - lastTime) < 10000) {
    return;
  }

  lastHeartbeatSent[key] = now;
  // Clear offline tracker since user is alive
  delete lastOfflineSent[key];

  try {
    const userDocRef = doc(db, `watchRooms/${roomId}/users`, userId);
    await setDoc(userDocRef, {
      lastSeen: now,
      connectionStatus: 'online',
      status: 'watching',
      ...extra
    }, { merge: true });
  } catch (error) {
    console.debug('Heartbeat update non-fatal:', error);
  }
}

/**
 * Marks a user as disconnected / offline without removing them from the room.
 * Throttled to avoid duplicate offline writes within 10 seconds.
 */
export async function markUserOffline(
  roomId: string,
  userId: string
): Promise<void> {
  if (!roomId || !userId) return;
  const key = `${roomId}:${userId}`;
  const now = Date.now();
  const lastOffline = lastOfflineSent[key] || 0;

  if ((now - lastOffline) < 10000) {
    return;
  }
  lastOfflineSent[key] = now;
  delete lastHeartbeatSent[key];

  try {
    const userDocRef = doc(db, `watchRooms/${roomId}/users`, userId);
    await updateDoc(userDocRef, {
      connectionStatus: 'offline',
      status: 'offline',
      lastSeen: now
    });
  } catch (error) {
    console.debug('Mark offline non-fatal:', error);
  }
}

/**
 * Formats a lastSeen timestamp into human readable text.
 */
export function formatLastSeen(lastSeen: unknown, now: number = Date.now()): string {
  if (!lastSeen) return 'Disconnected';
  let ms = 0;
  if (typeof lastSeen === 'number') {
    ms = lastSeen;
  } else if (typeof lastSeen === 'object' && lastSeen !== null && 'toMillis' in lastSeen && typeof (lastSeen as { toMillis: () => number }).toMillis === 'function') {
    ms = (lastSeen as { toMillis: () => number }).toMillis();
  } else if (typeof lastSeen === 'string') {
    ms = new Date(lastSeen).getTime();
  }
  if (!ms || isNaN(ms)) return 'Disconnected';

  const diffSeconds = Math.max(0, Math.floor((now - ms) / 1000));
  if (diffSeconds < 25) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
