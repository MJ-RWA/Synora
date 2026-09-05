import { 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  DocumentReference,
  CollectionReference,
  Query,
  DocumentData,
  SnapshotListenOptions,
  FirestoreError
} from 'firebase/firestore';
import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  // If it's a transient network or offline state, log a soft warning rather than a fatal crash
  if (
    errMsg.includes('offline') || 
    errMsg.includes('network-request-failed') || 
    errMsg.includes('unavailable') || 
    errMsg.includes('transport errored')
  ) {
    console.warn('Firestore offline / network status:', JSON.stringify(errInfo));
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const safeGetDoc = async <T = DocumentData>(ref: DocumentReference<T>) => {
  try {
    return await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, ref.path);
    throw error;
  }
};

export const safeGetDocs = async <T = DocumentData>(ref: Query<T>) => {
  try {
    return await getDocs(ref);
  } catch (error) {
    // Query doesn't have path, but we can try to get it from the underlying collection if it's a simple query
    const path = (ref as unknown as { path?: string }).path || 'query';
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
};

export const safeSetDoc = async <T = DocumentData>(ref: DocumentReference<T>, data: Partial<T>, options?: { merge?: boolean; mergeFields?: (string | string[])[] }) => {
  try {
    if (options) {
      return await setDoc(ref, data, options);
    }
    return await setDoc(ref, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ref.path);
    throw error;
  }
};

export const safeAddDoc = async <T = DocumentData>(ref: CollectionReference<T>, data: T) => {
  try {
    return await addDoc(ref, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ref.path);
    throw error;
  }
};

export const safeUpdateDoc = async <T = DocumentData>(ref: DocumentReference<T>, data: Partial<T>) => {
  try {
    // @ts-expect-error - Firestore UpdateData is complex
    return await updateDoc(ref, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, ref.path);
    throw error;
  }
};

export const safeDeleteDoc = async <T = DocumentData>(ref: DocumentReference<T>) => {
  try {
    return await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, ref.path);
    throw error;
  }
};

export const safeOnSnapshot = <T = DocumentData>(
  ref: Query<T> | DocumentReference<T>,
  onNext: (snapshot: unknown) => void,
  options?: SnapshotListenOptions
) => {
  const path = (ref as unknown as { path?: string }).path || 'query';
  // @ts-expect-error - Firestore onSnapshot types are complex
  return onSnapshot(
    ref,
    options || {},
    onNext,
    (error: FirestoreError) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
};
