import { 
  doc, 
  getDoc, 
  updateDoc, 
  increment, 
  arrayUnion, 
  arrayRemove, 
  addDoc, 
  collection 
} from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';

export async function recordWatchTime(
  userId: string, 
  seconds: number, 
  isHost: boolean = false
): Promise<string[]> {
  if (!userId || seconds <= 0) return [];
  
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return [];

    const userData = userSnap.data() as User;
    const currentTotal = (userData.totalWatchSeconds || 0) + seconds;
    const currentBadges = new Set(userData.badges || []);
    const newBadges: string[] = [];

    // Award first_party
    if (!currentBadges.has('first_party')) {
      newBadges.push('first_party');
    }
    // Award party_host if hosting
    if (isHost && !currentBadges.has('party_host')) {
      newBadges.push('party_host');
    }
    // Award cinephile at 30 min (1800s)
    if (currentTotal >= 1800 && !currentBadges.has('cinephile')) {
      newBadges.push('cinephile');
    }
    // Award movie_marathoner at 2 hours (7200s)
    if (currentTotal >= 7200 && !currentBadges.has('movie_marathoner')) {
      newBadges.push('movie_marathoner');
    }
    // Award night_owl if past midnight
    const hour = new Date().getHours();
    if ((hour >= 0 && hour < 5) && !currentBadges.has('night_owl')) {
      newBadges.push('night_owl');
    }

    const updates: Record<string, unknown> = {
      totalWatchSeconds: increment(seconds),
    };

    if (newBadges.length > 0) {
      updates.badges = arrayUnion(...newBadges);
    }

    await updateDoc(userRef, updates);
    return newBadges;
  } catch (error) {
    console.warn('Non-fatal error tracking watch time:', error);
    return [];
  }
}

export async function hostMuteParticipant(
  roomId: string, 
  targetUserId: string, 
  mute: boolean
): Promise<boolean> {
  if (!roomId || !targetUserId) return false;
  try {
    const participantRef = doc(db, `watchRooms/${roomId}/users`, targetUserId);
    await updateDoc(participantRef, {
      mutedByHost: mute,
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `watchRooms/${roomId}/users/${targetUserId}`);
    return false;
  }
}

export async function updateUserPresence(
  userId: string, 
  status: 'online' | 'away' | 'watching' | 'offline', 
  customStatus?: string
): Promise<void> {
  if (!userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    const updates: Record<string, unknown> = { status };
    if (customStatus !== undefined) {
      updates.customStatus = customStatus;
    }
    await updateDoc(userRef, updates);
  } catch (error) {
    console.debug('Presence update non-fatal:', error);
  }
}

export async function getUserProfile(userId: string): Promise<User | null> {
  if (!userId) return null;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...snap.data() } as User;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userId}`);
    return null;
  }
}

export async function sendRoomInvite(
  fromUser: { uid: string; username: string },
  toUserId: string,
  roomId: string,
  roomTitle: string
): Promise<boolean> {
  if (!fromUser?.uid || !toUserId || !roomId) return false;
  try {
    await addDoc(collection(db, 'notifications'), {
      toUser: toUserId,
      type: 'invite',
      roomId,
      message: `${fromUser.username} invited you to watch "${roomTitle}"!`,
      read: false,
      time: new Date().toISOString()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'notifications/invite');
    return false;
  }
}

export async function toggleBlockUser(
  currentUserId: string, 
  targetUserId: string, 
  block: boolean
): Promise<void> {
  if (!currentUserId || !targetUserId) return;
  try {
    const userRef = doc(db, 'users', currentUserId);
    await updateDoc(userRef, {
      blockedUsers: block ? arrayUnion(targetUserId) : arrayRemove(targetUserId)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${currentUserId}/blockedUsers`);
  }
}
