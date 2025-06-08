// Configuración SEGURA de Firebase Admin para el Backend
// NO usamos credentials.json aquí - Cloud Run maneja la autenticación automáticamente

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Esta función inicializa Firebase Admin de forma segura
// En Cloud Run, applicationDefault() automáticamente usa las credenciales del servicio
export function initializeFirebaseAdmin() {
  // Evitamos inicializar múltiples veces
  if (getApps().length === 0) {
    const app = initializeApp({
      // applicationDefault() usa la cuenta de servicio de Cloud Run automáticamente
      credential: applicationDefault(),
      projectId: process.env.PROJECT_ID || 'apt-cubist-368817',
      // El bucket de Storage se crea automáticamente
      storageBucket: 'apt-cubist-368817.firebasestorage.app'
    });
    
    console.log('🔥 Firebase Admin inicializado correctamente');
    return app;
  }
  
  return getApps()[0];
}

// Instancias que usaremos en toda la aplicación
export const db = getFirestore();
export const storage = getStorage();

// Para desarrollo local
// export const GOOGLE_APPLICATION_CREDENTIALS = 'path/to/your/service-account-key.json';
