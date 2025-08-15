/* eslint-disable @typescript-eslint/no-explicit-any */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

export interface ClinicProfile {
  id: string;
  email: string;
  clinicName: string;
  licenseNumber: string;
  facilityType: 'hospital' | 'clinic' | 'health_center';
  createdAt: any;
  updatedAt?: any;
}

export interface PatientAssessment {
  id?: string;
  patientName: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  vitalSigns: {
    systolic?: number;
    diastolic?: number;
    heartRate?: number;
    respiratoryRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
  };
  painLevel: number;
  consciousnessLevel?: string;
  mobility?: string;
  symptoms: string[];
  conditions: string[];
  urgencyLevel: {
    level: number;
    name: string;
    color: string;
    maxWait: number;
  };
  urgencyScore: number;
  clinicId: string;
  timestamp: any;
  status: 'waiting' | 'in_progress' | 'completed';
}

export interface AppointmentRequest {
  id?: string;
  patientName: string;
  patientEmail?: string;
  patientPhone: string;
  requestedDate: string;
  requestedTime: string;
  reason: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  clinicId: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: any;
  updatedAt?: any;
}
