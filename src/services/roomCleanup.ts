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
