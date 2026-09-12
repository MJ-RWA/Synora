import { collection, query, where, getDocs, doc, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { WatchRoom } from '../types';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Checks if a public room has been inactive for 24 hours or longer.
 */
export function isRoomInactiveFor24Hours(room: Partial<WatchRoom>): boolean {
  // Only public rooms are subject to automatic 24-hour expiration
  if (room.isPrivate) {
    return false;
  }

  const now = Date.now();

  // Check updatedAt timestamp
  if (typeof room.updatedAt === 'number' && room.updatedAt > 0) {
    return now - room.updatedAt > TWENTY_FOUR_HOURS_MS;
  }

  // Check createdAt
  if (room.createdAt) {
    const createdTime = new Date(room.createdAt).getTime();
    if (!isNaN(createdTime) && createdTime > 0) {
      return now - createdTime > TWENTY_FOUR_HOURS_MS;
    }
  }

  return false;
}

/**
 * Sweeps and automatically deletes public watch rooms that have been inactive for 24 hours.
 * Returns the list of deleted room IDs.
 */
export async function cleanupInactivePublicRooms(): Promise<string[]> {
  const deletedRoomIds: string[] = [];

  try {
    // Query active and inactive public rooms in batches
    const roomsRef = collection(db, 'watchRooms');
    const q = query(
      roomsRef,
      where('isPrivate', '==', false),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const deletePromises: Promise<void>[] = [];

    snapshot.forEach((documentSnap) => {
      const roomData = documentSnap.data() as WatchRoom;
      if (isRoomInactiveFor24Hours(roomData)) {
        deletedRoomIds.push(documentSnap.id);
        deletePromises.push(
          deleteDoc(doc(db, 'watchRooms', documentSnap.id)).catch((err) => {
            console.warn(`[Cleanup] Could not delete inactive room ${documentSnap.id}:`, err);
          })
        );
      }
    });

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      console.log(`[Cleanup] Automatically deleted ${deletedRoomIds.length} public rooms inactive for 24+ hours.`);
    }
  } catch (error) {
    console.warn('[Cleanup] Error during inactive public rooms cleanup sweep:', error);
  }

  return deletedRoomIds;
}

/**
 * Starts a recurring background cleanup timer that runs automatically.
 */
let cleanupIntervalId: NodeJS.Timeout | null = null;

const DELETED_ROOMS_KEY = 'synora_deleted_room_ids';
const SAVED_ROOMS_KEY = 'synora_saved_room_ids';
const CREATED_ROOMS_KEY = 'synora_created_rooms';

/**
 * Checks if a room has been marked as deleted locally on this device.
 */
export function isRoomDeletedLocally(roomId: string): boolean {
  if (!roomId || typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(DELETED_ROOMS_KEY);
    if (!raw) return false;
    const deletedIds: string[] = JSON.parse(raw);
    return Array.isArray(deletedIds) && deletedIds.includes(roomId);
  } catch {
    return false;
  }
}

/**
 * Instantly purges a room ID and all its metadata from localStorage caches and broadcasts the deletion event.
 */
export function purgeRoomFromLocalState(roomId: string): void {
  if (!roomId || typeof window === 'undefined') return;
  try {
    // 1. Purge from synora_saved_room_ids
    const savedIdsRaw = localStorage.getItem(SAVED_ROOMS_KEY);
    if (savedIdsRaw) {
      const ids: string[] = JSON.parse(savedIdsRaw);
      localStorage.setItem(SAVED_ROOMS_KEY, JSON.stringify(ids.filter(id => id !== roomId)));
    }

    // 2. Purge from synora_created_rooms
    const createdRaw = localStorage.getItem(CREATED_ROOMS_KEY);
    if (createdRaw) {
      const rooms: Array<{ id: string }> = JSON.parse(createdRaw);
      localStorage.setItem(CREATED_ROOMS_KEY, JSON.stringify(rooms.filter(r => r && r.id !== roomId)));
    }

    // 3. Record in synora_deleted_room_ids so listeners / offline caches never resurrect it
    const deletedRaw = localStorage.getItem(DELETED_ROOMS_KEY);
    const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
    if (!deletedList.includes(roomId)) {
      const updatedDeleted = [roomId, ...deletedList].slice(0, 100);
      localStorage.setItem(DELETED_ROOMS_KEY, JSON.stringify(updatedDeleted));
    }

    // 4. Dispatch a fast custom event to notify all components in the current window
    window.dispatchEvent(new CustomEvent('synora_room_deleted', { detail: { roomId } }));
  } catch (err) {
    console.warn('Error purging room from local state:', err);
  }
}

/**
 * Permanently deletes a room: immediately clears local cache and dispatches removal,
 * then purges the Firestore document.
 */
export async function deleteRoomPermanently(roomId: string): Promise<void> {
  if (!roomId) return;
  
  // Instant optimistic purge
  purgeRoomFromLocalState(roomId);

  // Firestore remote purge
  try {
    await deleteDoc(doc(db, 'watchRooms', roomId));
  } catch (deleteErr) {
    console.warn(`Direct deleteDoc failed for ${roomId}, attempting soft-delete flag:`, deleteErr);
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'watchRooms', roomId), {
        isDeleted: true,
        isActive: false,
        deletedAt: Date.now()
      });
    } catch (updateErr) {
      console.warn(`Soft-delete flag failed for ${roomId}:`, updateErr);
    }
  }
}

export function startAutoRoomCleanup(intervalMinutes = 15): () => void {
  // Run initial sweep on mount
  cleanupInactivePublicRooms();

  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
  }

  cleanupIntervalId = setInterval(() => {
    cleanupInactivePublicRooms();
  }, intervalMinutes * 60 * 1000);

  return () => {
    if (cleanupIntervalId) {
      clearInterval(cleanupIntervalId);
      cleanupIntervalId = null;
    }
  };
}
