import {
  initializeApp,
  getApps,
  getApp,
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  updateProfile,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  reload,
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  collection,
} from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js';

import { firebaseConfig } from './config.js';
import logger from '../utils/logger.js';
import { handleAuthError } from './auth-error-handler.js';

let app;
let auth;
let db;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    logger.info('Firebase initialized by Auth Service');
  } else {
    app = getApp();
    logger.info('Using existing Firebase instance');
  }

  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  logger.error('Firebase initialization error:', error);
  throw error;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

const SESSION_TIMEOUT = 30 * 60 * 1000;
const SESSION_WARNING_TIME = 5 * 60 * 1000;

const USER_ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  NURSE: 'nurse',
  PATIENT: 'patient',
  CLINIC_STAFF: 'clinic_staff',
  ORGANIZATION_ADMIN: 'organization_admin',
  ORGANIZATION_MEMBER: 'organization_member',
  SYSTEM_ADMIN: 'system_admin',
};

const SECURE_SESSION_KEYS = {
  SESSION_START: 'auth_session_start',
  LAST_ACTIVITY: 'auth_last_activity',
  LOGIN_ATTEMPTS: 'auth_login_attempts',
  LOCKOUT_UNTIL: 'auth_lockout_until',
};

class SecureSessionManager {
  constructor() {
    this.sensitiveData = new Map();
    this.sessionActive = false;
  }

  setSensitiveData(key, value) {
    this.sensitiveData.set(key, value);
  }

  getSensitiveData(key) {
    return this.sensitiveData.get(key);
  }

  clearSensitiveData() {
    this.sensitiveData.clear();
    this.sessionActive = false;
  }

  isSessionActive() {
    return this.sessionActive && this.sensitiveData.size > 0;
  }

  setSessionActive(active) {
    this.sessionActive = active;
  }
}

const secureSession = new SecureSessionManager();

class AuthService {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
    this.sessionTimer = null;
    this.warningTimer = null;
    this.authListeners = [];
    this.sessionListeners = [];
    this.authPopupWindow = null;
    this.isInitialized = false;
    this.initializationPromise = new Promise(resolve => {
      this.resolveInitialization = resolve;
    });

    this.initializeSessionManagement();
    this.setupAuthStateListener();
    this.setupPopupCleanup();

    logger.info('Authentication Service initialized');
  }

  setupPopupCleanup() {
    window.addEventListener('beforeunload', () => {
      this.closeAuthPopup();
    });

    window.addEventListener('message', event => {
      if (
        event.origin === window.location.origin &&
        event.data?.type === 'CLOSE_AUTH_POPUP'
      ) {
        this.closeAuthPopup();
      }
    });
  }

  closeAuthPopup() {
    try {
      if (this.authPopupWindow && !this.authPopupWindow.closed) {
        logger.info('Closing auth popup window');
        this.authPopupWindow.close();
        this.authPopupWindow = null;
      }

      if (window.authPopup && !window.authPopup.closed) {
        window.authPopup.close();
        window.authPopup = null;
      }
    } catch (error) {
      logger.warn('Error closing auth popup:', error);
    }
  }

  async waitForInitialization() {
    if (this.isInitialized) {
      return Promise.resolve();
    }
    return this.initializationPromise;
  }

  initializeSessionManagement() {
    const sessionStart = sessionStorage.getItem(
      SECURE_SESSION_KEYS.SESSION_START
    );
    const lastActivity = sessionStorage.getItem(
      SECURE_SESSION_KEYS.LAST_ACTIVITY
    );

    if (sessionStart && lastActivity) {
      const now = Date.now();
      const sessionAge = now - parseInt(sessionStart);
      const timeSinceActivity = now - parseInt(lastActivity);

      if (sessionAge > SESSION_TIMEOUT || timeSinceActivity > SESSION_TIMEOUT) {
        this.clearSession();
        this.redirectToLogin('Session expired. Please login again.');
        return;
      }

      this.updateLastActivity();
    }

    this.setupActivityTracking();
  }

  setupActivityTracking() {
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach(event => {
      document.addEventListener(
        event,
        () => {
          this.updateLastActivity();
        },
        { passive: true }
      );
    });
  }

  updateLastActivity() {
    sessionStorage.setItem(
      SECURE_SESSION_KEYS.LAST_ACTIVITY,
      Date.now().toString()
    );

    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
    }

    this.warningTimer = setTimeout(() => {
      this.showSessionWarning();
    }, SESSION_TIMEOUT - SESSION_WARNING_TIME);

    this.sessionTimer = setTimeout(() => {
      this.handleSessionTimeout();
    }, SESSION_TIMEOUT);
  }

  showSessionWarning() {
    const proceed = confirm(
      'Your session will expire in 5 minutes. Click OK to continue your session.'
    );

    if (proceed) {
      this.updateLastActivity();
    } else {
      this.logout();
    }
  }

  handleSessionTimeout() {
    this.clearSession();
    this.logout();
    this.redirectToLogin('Your session has expired. Please login again.');
  }

  setupAuthStateListener() {
    onAuthStateChanged(auth, async user => {
      logger.info('Auth state change detected.', { providedUser: !!user });

      if (user) {
        const userIsValid = await this.validateUserSession(user);
        if (userIsValid) {
          await this.loadUserData(user);
        } else {
          await this.logout();
          return;
        }
      } else {
        this.clearSession();
      }

      this.notifyAuthListeners(this.currentUser, this.userRole);

      if (!this.isInitialized) {
        this.isInitialized = true;
        this.resolveInitialization();
        logger.info('Auth Service has completed initial state check.');
      }
    });
  }

  async validateUserSession(user) {
    if (!user || !user.uid) {
      return false;
    }

    try {
      return true;
    } catch (error) {
      logger.error('Error validating user session:', error);
      return false;
    }
  }

  requireEmailVerification() {
    return true;
  }

  async handleUnverifiedEmail(user) {
    await signOut(auth);
    this.showEmailVerificationMessage(user.email);
    this.redirectToLogin('Please verify your email before signing in.');
  }

  showEmailVerificationMessage(email) {
    const message = `
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <h3 style="color: #0c4a6e; margin: 0 0 8px 0;">📧 Email Verification Required</h3>
                <p style="color: #075985; margin: 0;">
                    Please check your email (${email}) and click the verification link before signing in.
                </p>
                <p style="color: #075985; margin: 8px 0 0 0; font-size: 0.9em;">
                    Didn't receive the email? Check your spam folder or try signing up again.
                </p>
            </div>
        `;

    const container =
      document.getElementById('auth-messages') ||
      document.getElementById('error-container');
    if (container) {
      container.innerHTML = message;
      container.scrollIntoView({ behavior: 'smooth' });
    } else {
      alert(`Please verify your email (${email}) before signing in.`);
    }
  }

  async loadUserData(user) {
    if (!user) {
      this.clearSession();
      return null;
    }

    try {
      this.currentUser = user;
      this.userRole = USER_ROLES.PATIENT;

      try {
        const userDocRef = doc(db, 'patients', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          this.userRole = userData.role || USER_ROLES.PATIENT;
          logger.info('User data loaded successfully from Firestore');
        } else {
          try {
            this.userRole = await this.createUserDocument(user);
            logger.info('New user document created successfully');
          } catch (createError) {
            logger.warn(
              'Could not create user document, using default role:',
              createError.message
            );
          }
        }
      } catch (firestoreError) {
        logger.warn(
          'Firestore access error, continuing with default role:',
          firestoreError.message
        );
      }

      this.startSecureSession(user);
      this.notifyAuthListeners(user, this.userRole);
      return this.userRole;
    } catch (error) {
      logger.error('Critical error in loadUserData:', error);
      this.currentUser = user;
      this.userRole = USER_ROLES.PATIENT;
      this.startSecureSession(user);
      this.notifyAuthListeners(user, this.userRole);
      return this.userRole;
    }
  }

  async createUserDocument(user) {
    const userDocRef = doc(db, 'patients', user.uid);
    const newUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'New Patient',
      role: USER_ROLES.PATIENT,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    };

    try {
      await setDoc(userDocRef, newUser);
      logger.info('New patient document created for:', user.email);
      return newUser.role;
    } catch (error) {
      logger.warn(
        'Could not create user document in Firestore:',
        error.message
      );
      return USER_ROLES.PATIENT;
    }
  }

  async updatePatientLastLogin(userId) {
    const userDocRef = doc(db, 'patients', userId);
    try {
      await updateDoc(userDocRef, {
        lastLoginAt: serverTimestamp(),
      });
    } catch (error) {
      logger.warn('Could not update last login:', error);
    }
  }

  startSecureSession(user) {
    const now = Date.now();

    sessionStorage.setItem(SECURE_SESSION_KEYS.SESSION_START, now.toString());
    sessionStorage.setItem(SECURE_SESSION_KEYS.LAST_ACTIVITY, now.toString());

    secureSession.setSensitiveData('userId', user.uid);
    secureSession.setSensitiveData('userEmail', user.email);
    secureSession.setSensitiveData('emailVerified', user.emailVerified);
    secureSession.setSessionActive(true);

    if (window.csrfService && window.csrfService.fetchToken) {
      window.csrfService.fetchToken().catch(error => {
        logger.warn('Failed to initialize CSRF token:', error.message);
      });
    }

    this.updateLastActivity();

    logger.info('🔒 Secure session started for user');
  }

  clearSession() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }

    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }

    Object.values(SECURE_SESSION_KEYS).forEach(key => {
      if (
        key !== SECURE_SESSION_KEYS.LOGIN_ATTEMPTS &&
        key !== SECURE_SESSION_KEYS.LOCKOUT_UNTIL
      ) {
        sessionStorage.removeItem(key);
      }
    });

    if (window.csrfService && window.csrfService.logout) {
      window.csrfService.logout();
    }

    secureSession.clearSensitiveData();

    logger.info('🔒 Secure session cleared');
  }

  forceClearAuthState() {
    logger.debug(' Force clearing all authentication state');

    this.currentUser = null;
    this.userRole = null;

    this.clearSession();

    const nonSensitiveKeys = ['auth_redirect_message', 'auth_return_url'];

    nonSensitiveKeys.forEach(key => {
      if (sessionStorage.getItem(key)) {
        sessionStorage.removeItem(key);
        logger.debug(`🧹 Cleared sessionStorage key: ${key}`);
      }
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        logger.debug(`🧹 Cleared localStorage key: ${key}`);
      }
    });

    if (typeof window !== 'undefined') {
      window.isRedirecting = false;
      window.redirectCount = 0;
      window.lastRedirectTime = 0;
    }

    logger.info(' All authentication state cleared');
  }

  async loginWithEmail(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      if (user) {
        await this.loadUserData(user);
        return user;
      }
    } catch (error) {
      throw handleAuthError(error);
    }
  }

  async loginWithGooglePopup() {
    try {
      this.closeAuthPopup();
      return await signInWithPopup(auth, googleProvider);
    } catch (error) {
      throw handleAuthError(error);
    }
  }

  async registerWithEmail(email, password, userData = {}) {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      if (userData.displayName) {
        await updateProfile(user, {
          displayName: userData.displayName,
        });
      }

      await sendEmailVerification(user);

      await this.createUserDocument(user);

      await signOut(auth);

      return user;
    } catch (error) {
      logger.error('Registration error:', error);
      this.clearSession();
      throw handleAuthError(error);
    }
  }

  async logout() {
    try {
      await signOut(auth);
      this.clearSession();
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  async updateUserPassword(currentPassword, newPassword) {
    try {
      if (!this.currentUser) {
        throw new Error('No authenticated user');
      }

      const credential = EmailAuthProvider.credential(
        this.currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(this.currentUser, credential);

      await updatePassword(this.currentUser, newPassword);
    } catch (error) {
      logger.error('Password update error:', error);
      throw error;
    }
  }

  async deleteAccount(password) {
    try {
      if (!this.currentUser) {
        throw new Error('No authenticated user');
      }

      const credential = EmailAuthProvider.credential(
        this.currentUser.email,
        password
      );
      await reauthenticateWithCredential(this.currentUser, credential);

      await deleteDoc(doc(db, 'users', this.currentUser.uid));

      try {
        await deleteDoc(doc(db, 'patients', this.currentUser.uid));
      } catch (error) {}

      await deleteUser(this.currentUser);

      this.clearSession();
    } catch (error) {
      logger.error('Account deletion error:', error);
      throw error;
    }
  }

  async updateUserRole(userId, newRole) {
    try {
      if (this.userRole !== USER_ROLES.ADMIN) {
        throw new Error('Insufficient permissions');
      }

      if (!Object.values(USER_ROLES).includes(newRole)) {
        throw new Error('Invalid role');
      }

      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        roleUpdatedAt: serverTimestamp(),
        roleUpdatedBy: this.currentUser.uid,
      });
    } catch (error) {
      logger.error('Role update error:', error);
      throw error;
    }
  }

  hasRole(requiredRole) {
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(this.userRole);
    }
    return this.userRole === requiredRole;
  }

  hasPermission(permission) {
    const rolePermissions = {
      [USER_ROLES.SYSTEM_ADMIN]: ['all'],
      [USER_ROLES.ADMIN]: ['all'],
      [USER_ROLES.ORGANIZATION_ADMIN]: [
        'manage_organization',
        'read_organization_patients',
        'write_organization_patients',
        'manage_staff',
        'read_appointments',
        'write_appointments',
      ],
      [USER_ROLES.DOCTOR]: [
        'read_patients',
        'write_patients',
        'read_appointments',
        'write_appointments',
      ],
      [USER_ROLES.NURSE]: [
        'read_patients',
        'read_appointments',
        'write_appointments',
      ],
      [USER_ROLES.CLINIC_STAFF]: ['read_appointments', 'write_appointments'],
      [USER_ROLES.ORGANIZATION_MEMBER]: [
        'read_organization_patients',
        'read_appointments',
        'write_appointments',
      ],
      [USER_ROLES.PATIENT]: ['read_own_data', 'write_own_data'],
    };

    const userPermissions = rolePermissions[this.userRole] || [];
    return (
      userPermissions.includes('all') || userPermissions.includes(permission)
    );
  }

  getCurrentUser() {
    const firebaseCurrentUser = auth.currentUser;

    if (!this.currentUser && firebaseCurrentUser) {
      logger.debug(' Firebase user found but not in auth service, syncing...');
      this.currentUser = firebaseCurrentUser;
      return firebaseCurrentUser;
    }

    if (this.currentUser && !firebaseCurrentUser) {
      logger.warn(" Auth service has user but Firebase doesn't, clearing...");
      this.currentUser = null;
      this.userRole = null;
      return null;
    }

    if (
      this.currentUser &&
      firebaseCurrentUser &&
      this.currentUser.uid !== firebaseCurrentUser.uid
    ) {
      logger.warn(' User UID mismatch, clearing auth state');
      this.currentUser = null;
      this.userRole = null;
      return null;
    }

    return this.currentUser;
  }

  getUserRole() {
    return this.userRole;
  }

  isAuthenticated() {
    if (!this.currentUser || !this.currentUser.uid) {
      return false;
    }

    const firebaseCurrentUser = auth.currentUser;
    if (
      !firebaseCurrentUser ||
      firebaseCurrentUser.uid !== this.currentUser.uid
    ) {
      logger.warn(' Auth state mismatch detected, clearing current user');
      this.currentUser = null;
      this.userRole = null;
      return false;
    }

    return true;
  }

  onAuthStateChange(callback) {
    this.authListeners.push(callback);

    return () => {
      const index = this.authListeners.indexOf(callback);
      if (index > -1) {
        this.authListeners.splice(index, 1);
      }
    };
  }

  notifyAuthListeners(user, role) {
    this.authListeners.forEach(callback => {
      try {
        callback(user, role);
      } catch (error) {
        logger.error('Auth listener error:', error);
      }
    });
  }

  redirectToLogin(message = '') {
    if (message) {
      sessionStorage.setItem('auth_message', message);
    }

    const currentPath = window.location.pathname;

    if (currentPath.includes('admin')) {
      window.location.href = '/admin/login.html';
    } else if (currentPath.includes('doctor')) {
      window.location.href = '/doctor/login.html';
    } else {
      window.location.href = '/public/patientSign-in.html';
    }
  }

  redirectAfterLogin(role) {
    const userRole = role || this.userRole;
    logger.debug('Redirecting after login with role:', userRole);

    if (!this.currentUser || !userRole) {
      logger.warn('No user or role found, defaulting to patient portal');
      const finalRole = userRole || USER_ROLES.PATIENT;
      this.redirectAfterLogin(finalRole);
      return;
    }

    window.isRedirecting = true;

    let redirectUrl;
    switch (userRole) {
      case USER_ROLES.SYSTEM_ADMIN:
        redirectUrl = '/admin/system-dashboard.html';
        break;
      case USER_ROLES.ADMIN:
        redirectUrl = '/admin/dashboard.html';
        break;
      case USER_ROLES.ORGANIZATION_ADMIN:
        redirectUrl = '/business/organization-dashboard.html';
        break;
      case USER_ROLES.ORGANIZATION_MEMBER:
        redirectUrl = '/business/member-dashboard.html';
        break;
      case USER_ROLES.DOCTOR:
        redirectUrl = '/doctor/dashboard.html';
        break;
      case USER_ROLES.NURSE:
        redirectUrl = '/nurse/dashboard.html';
        break;
      case USER_ROLES.CLINIC_STAFF:
        redirectUrl = '/staff/dashboard.html';
        break;
      case USER_ROLES.PATIENT:
        redirectUrl = '/public/patientPortal.html';
        break;
      default:
        redirectUrl = '/public/patientPortal.html';
    }

    logger.debug(' Redirecting to:', redirectUrl);

    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 500);
  }

  getSessionInfo() {
    const sessionStart = sessionStorage.getItem(
      SECURE_SESSION_KEYS.SESSION_START
    );
    const lastActivity = sessionStorage.getItem(
      SECURE_SESSION_KEYS.LAST_ACTIVITY
    );

    if (!sessionStart || !lastActivity) {
      return null;
    }

    const now = Date.now();
    const sessionAge = now - parseInt(sessionStart);
    const timeSinceActivity = now - parseInt(lastActivity);

    return {
      sessionStart: parseInt(sessionStart),
      lastActivity: parseInt(lastActivity),
      sessionAge,
      timeSinceActivity,
      timeRemaining: SESSION_TIMEOUT - timeSinceActivity,
    };
  }

  async signInWithGoogle() {
    logger.info('Attempting Google sign-in with redirect');

    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      logger.error('Google sign-in redirect error:', error);
      throw handleAuthError(error);
    }
  }
}

const authService = new AuthService();

export {
  authService as default,
  AuthService,
  USER_ROLES,
  SECURE_SESSION_KEYS,
  auth,
};
