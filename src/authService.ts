import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser,
  AuthError
} from 'firebase/auth';
import { 
  doc, 
  setDoc,
} from 'firebase/firestore';
import { User } from './types';

const createUserDoc = async (user: FirebaseUser, username?: string) => {
  try {
    const userRef = doc(db, 'users', user.uid);
    const isSuperAdminEmail = user.email === "believeinsomething2421@gmail.com";
    const newUser: Partial<User> = {
      username: username || user.displayName || (isSuperAdminEmail ? 'Admin' : 'User'),
      email: user.email || '',
      role: isSuperAdminEmail ? 'admin' : 'user',
      favorites: [],
      history: [],
      friends: [],
      createdAt: new Date().toISOString()
    };
    await setDoc(userRef, newUser, { merge: true });
  } catch (error) {
    console.warn("User document creation deferred or offline sync active:", error);
  }
};

const provider = new GoogleAuthProvider();
// Force account selection to help with login issues
provider.setCustomParameters({
  prompt: 'select_account'
});

let isLoginInProgress = false;

export const loginWithGoogle = async () => {
  if (isLoginInProgress) {
    console.warn("Login already in progress...");
    return;
  }

  console.log("Starting Google Login from domain:", window.location.hostname);
  isLoginInProgress = true;
  try {
    const result = await signInWithPopup(auth, provider);
    await createUserDoc(result.user);
    return result.user;
  } catch (err: unknown) {
    const error = err as AuthError;
    console.error("Google Login Error Details:", {
      code: error.code,
      message: error.message,
      customData: error.customData,
      stack: error.stack
    });

    if (error.code === 'auth/popup-blocked') {
      throw new Error("Login popup was blocked. Please allow popups for this site or open the app in a new tab to sign in.", { cause: err });
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.log("Popup request was cancelled or replaced.");
    } else if (error.code === 'auth/popup-closed-by-user') {
      console.log("Login popup was closed by user.");
    } else if (error.code === 'auth/unauthorized-domain') {
      console.error("This domain is not authorized in Firebase Console. Please ensure the current URL is added to Authorized Domains in Authentication settings.");
      throw new Error("This domain is not authorized for Google Login in Firebase. Please open the app in a new tab or use email sign-in.", { cause: err });
    } else if (error.code === 'auth/network-request-failed') {
      const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (isInIframe) {
        throw new Error("Google popup sign-in is blocked by browser iframe security. Please click 'Open in New Tab' below or sign in using Email & Password.", { cause: err });
      }
      throw new Error("Network connection error. Please check your internet connection and try again.", { cause: err });
    } else {
      throw err;
    }
  } finally {
    isLoginInProgress = false;
  }
};

export const loginWithEmail = async (email: string, pass: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (err: unknown) {
    const error = err as AuthError;
    console.error("Email login failed:", error);
    
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      throw new Error("Invalid email or password. Please try again.", { cause: err });
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error("Too many failed login attempts. Please try again later.", { cause: err });
    }
    throw err;
  }
};

export const registerWithEmail = async (email: string, pass: string, username: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(result.user, { displayName: username });
    await createUserDoc(result.user, username);
    return result.user;
  } catch (err: unknown) {
    const error = err as AuthError;
    console.error("Registration failed:", error);
    
    if (error.code === 'auth/email-already-in-use') {
      throw new Error("This email is already registered. Try signing in instead.", { cause: err });
    } else if (error.code === 'auth/weak-password') {
      throw new Error("Password is too weak. Please use at least 6 characters.", { cause: err });
    } else if (error.code === 'auth/invalid-email') {
      throw new Error("Please enter a valid email address.", { cause: err });
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error("Email/Password signup is not enabled. Please enable it in the Firebase Console under Authentication > Sign-in method.", { cause: err });
    }
    throw err;
  }
};

export const logout = () => signOut(auth);
