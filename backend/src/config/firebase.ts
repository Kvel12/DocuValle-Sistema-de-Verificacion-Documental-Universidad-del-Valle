// Configuración SEGURA de Firebase Admin para el Backend
// NO usamos credentials.json aquí - Cloud Run maneja la autenticación automáticamente

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Variables globales (se inicializan en initializeFirebaseAdmin)
export let db: any;
export let storage: any;

// Esta función inicializa Firebase Admin de forma segura
export function initializeFirebaseAdmin() {
  try {
    console.log('🔄 Inicializando Firebase Admin...');
    
    // Evitamos inicializar múltiples veces
    if (getApps().length === 0) {
      const app = initializeApp({
        credential: applicationDefault(),
        projectId: process.env.PROJECT_ID || 'apt-cubist-368817',
        storageBucket: 'apt-cubist-368817.firebasestorage.app'
      });
      
      console.log('✅ Firebase App inicializado');
      
      // DESPUÉS de inicializar Firebase, crear las instancias
      db = getFirestore(app);
      storage = getStorage(app);
      
      console.log('✅ Firestore y Storage inicializados');
      return app;
    } else {
      // Si ya está inicializado, obtener las instancias
      const app = getApps()[0];
      db = getFirestore(app);
      storage = getStorage(app);
      console.log('✅ Firebase ya estaba inicializado');
      return app;
    }
    
  } catch (error) {
    console.error('❌ Error inicializando Firebase Admin:', error);
    throw error;
  }
}