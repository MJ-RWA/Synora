import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  FacebookAuthProvider,
  OAuthProvider,
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

export const getPhotoUrl = (user: FirebaseUser): string | undefined => {
  if (user.photoURL) return user.photoURL;
  if (user.providerData && user.providerData.length > 0) {
    for (const p of user.providerData) {
      if (p.photoURL) return p.photoURL;
    }
  }
  return undefined;
};

const createUserDoc = async (user: FirebaseUser, username?: string) => {
  try {
    const userRef = doc(db, 'users', user.uid);
    const isSuperAdminEmail = user.email === "believeinsomething2421@gmail.com";
    const photoUrl = getPhotoUrl(user);
    
    const newUser: Partial<User> = {
      username: username || user.displayName || (isSuperAdminEmail ? 'Admin' : 'User'),
      email: user.email || '',
      role: isSuperAdminEmail ? 'admin' : 'user',
      favorites: [],
      history: [],
      friends: [],
      createdAt: new Date().toISOString()
    };

    if (photoUrl) {
      newUser.avatarUrl = photoUrl;
    }

    await setDoc(userRef, newUser, { merge: true });
  } catch (error) {
    console.warn("User document creation deferred or offline sync active:", error);
  }
};

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('email');
facebookProvider.addScope('public_profile');
facebookProvider.setCustomParameters({
  display: 'popup'
});

const instagramProvider = new OAuthProvider('instagram.com');
instagramProvider.addScope('user_profile');

let isLoginInProgress = false;

export const loginWithGoogle = async () => {
  if (isLoginInProgress) {
    console.warn("Login already in progress...");
    return;
  }

  console.log("Starting Google Login from domain:", window.location.hostname);
  isLoginInProgress = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
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

export const loginWithFacebook = async () => {
  if (isLoginInProgress) {
    console.warn("Login already in progress...");
    return;
  }

  console.log("Starting Facebook Login from domain:", window.location.hostname);
  isLoginInProgress = true;
  try {
    const result = await signInWithPopup(auth, facebookProvider);
    await createUserDoc(result.user);
    return result.user;
  } catch (err: unknown) {
    const error = err as AuthError;
    console.error("Facebook Login Error:", error);

    if (error.code === 'auth/popup-blocked') {
      throw new Error("Facebook login popup was blocked. Please allow popups for this site or open the app in a new tab to sign in.", { cause: err });
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.log("Popup request was cancelled.");
    } else if (error.code === 'auth/popup-closed-by-user') {
      console.log("Login popup was closed by user.");
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error("Facebook Login is not yet enabled in Firebase Console. Enable Facebook under Firebase Authentication > Sign-in method.", { cause: err });
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      throw new Error("An account already exists with this email address using another sign-in provider.", { cause: err });
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error("This domain is not authorized for Facebook login in Firebase. Please add this domain to Authorized Domains in Firebase Authentication.", { cause: err });
    } else {
      throw err;
    }
  } finally {
    isLoginInProgress = false;
  }
};

export const loginWithInstagram = async () => {
  if (isLoginInProgress) {
    console.warn("Login already in progress...");
    return;
  }

  console.log("Starting Instagram Login from domain:", window.location.hostname);
  isLoginInProgress = true;
  try {
    const result = await signInWithPopup(auth, instagramProvider);
    await createUserDoc(result.user);
    return result.user;
  } catch (err: unknown) {
    const error = err as AuthError;
    console.error("Instagram Login Error:", error);

    if (error.code === 'auth/popup-blocked') {
      throw new Error("Instagram login popup was blocked. Please allow popups for this site or open the app in a new tab to sign in.", { cause: err });
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.log("Popup request was cancelled.");
    } else if (error.code === 'auth/popup-closed-by-user') {
      console.log("Login popup was closed by user.");
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error("Instagram OAuth is not yet enabled in Firebase Console. Configure the Instagram provider under Firebase Authentication.", { cause: err });
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      throw new Error("An account already exists with this email address using another sign-in provider.", { cause: err });
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error("This domain is not authorized for Instagram login in Firebase. Please add this domain to Authorized Domains in Firebase Authentication.", { cause: err });
    } else {
      throw err;
    }
  } finally {
    isLoginInProgress = false;
  }
};

export const updateUsername = async (newUsername: string) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("You must be logged in to update your username.");
  const trimmed = newUsername.trim();
  if (!trimmed) throw new Error("Username cannot be empty.");
  if (trimmed.length < 2) throw new Error("Username must be at least 2 characters.");
  if (trimmed.length > 30) throw new Error("Username cannot exceed 30 characters.");

  // Update Firebase Auth profile displayName
  await updateProfile(currentUser, { displayName: trimmed });

  // Update Firestore user document
  const userRef = doc(db, 'users', currentUser.uid);
  await setDoc(userRef, { username: trimmed }, { merge: true });

  return trimmed;
};

export const updateUserAvatar = async (avatarUrl: string) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("You must be logged in to update your avatar.");
  const trimmed = avatarUrl.trim();

  await updateProfile(currentUser, { photoURL: trimmed });
  const userRef = doc(db, 'users', currentUser.uid);
  await setDoc(userRef, { avatarUrl: trimmed }, { merge: true });
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
