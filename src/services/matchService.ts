import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Match } from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';

export const getMatches = async (): Promise<Match[]> => {
  try {
    const matchesRef = collection(db, 'matches');
    const q = query(matchesRef, orderBy('time', 'asc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Match));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'matches');
    return [];
  }
};
