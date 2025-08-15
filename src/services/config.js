const getEnvVar = (key, fallback) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || fallback;
  }

  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback;
  }

  if (typeof window !== 'undefined' && window.env) {
    return window.env[key] || fallback;
  }

  return fallback;
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', null),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', null),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', null),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', null),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', null),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', null),
  measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID', null),
};

const requiredFields = ['apiKey', 'authDomain', 'projectId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

if (missingFields.length > 0) {
  throw new Error(
    `Firebase configuration incomplete. Missing: ${missingFields.join(', ')}`
  );
}

export { firebaseConfig };
