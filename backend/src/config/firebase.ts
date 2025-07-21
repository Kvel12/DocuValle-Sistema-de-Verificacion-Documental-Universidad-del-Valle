// Configuración UNIVERSAL de Firebase Admin para Backend
// Funciona automáticamente en local (con service account) y en Cloud Run

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as path from 'path';
import * as fs from 'fs';

// Variables globales (se inicializan en initializeFirebaseAdmin)
export let db: any;
export let storage: any;

// Esta función inicializa Firebase Admin de forma segura
export function initializeFirebaseAdmin() {
  try {
    console.log('🔄 Inicializando Firebase Admin...');
    console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'production'}`);
    
    // Evitamos inicializar múltiples veces
    if (getApps().length === 0) {
      let app;
      
      // DETECCIÓN AUTOMÁTICA del entorno
      const isLocal = process.env.NODE_ENV === 'development';
      const hasServiceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      // ESTRATEGIA 1: Desarrollo local con service account key
      if (isLocal && hasServiceAccountPath) {
        const serviceAccountPath = path.resolve(__dirname, hasServiceAccountPath);
        
        if (fs.existsSync(serviceAccountPath)) {
          console.log(`🔑 Usando service account key: ${serviceAccountPath}`);
          const serviceAccount = require(serviceAccountPath);
          
          app = initializeApp({
            credential: cert(serviceAccount),
            projectId: process.env.PROJECT_ID || 'apt-cubist-368817',
            storageBucket: 'apt-cubist-368817.firebasestorage.app'
          });
          
          console.log('✅ Firebase inicializado con service account key (desarrollo local)');
        } else {
          console.log(`⚠️ Service account key no encontrado en: ${serviceAccountPath}`);
          console.log('🔄 Fallback a credenciales por defecto...');
          
          app = initializeApp({
            credential: applicationDefault(),
            projectId: process.env.PROJECT_ID || 'apt-cubist-368817',
            storageBucket: 'apt-cubist-368817.firebasestorage.app'
          });
          
          console.log('✅ Firebase inicializado con credenciales por defecto (fallback)');
        }
      } 
      // ESTRATEGIA 2: Producción o desarrollo sin service account
      else {
        console.log('🚀 Usando credenciales por defecto (Cloud Run o gcloud auth)');
        
        app = initializeApp({
          credential: applicationDefault(),
          projectId: process.env.PROJECT_ID || 'apt-cubist-368817',
          storageBucket: 'apt-cubist-368817.firebasestorage.app'
        });
        
        console.log('✅ Firebase inicializado con credenciales por defecto');
      }
      
      // DESPUÉS de inicializar Firebase, crear las instancias
      db = getFirestore(app);
      storage = getStorage(app);
      
      console.log('✅ Firestore y Storage inicializados');
      console.log(`📋 Proyecto: ${process.env.PROJECT_ID || 'apt-cubist-368817'}`);
      
      return app;
    } else {
      // Si ya está inicializado, obtener las instancias existentes
      const app = getApps()[0];
      db = getFirestore(app);
      storage = getStorage(app);
      console.log('✅ Firebase ya estaba inicializado (reutilizando)');
      return app;
    }
    
  } catch (error) {
    console.error('❌ Error inicializando Firebase Admin:', error);
    
    // Logging detallado para debug
    console.error(`🔍 Debug info:`);
    console.error(`   - NODE_ENV: ${process.env.NODE_ENV}`);
    console.error(`   - PROJECT_ID: ${process.env.PROJECT_ID}`);
    console.error(`   - GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    
    throw error;
  }
}