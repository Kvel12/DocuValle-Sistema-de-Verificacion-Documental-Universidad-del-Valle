// Configuración PÚBLICA de Firebase para el Frontend
// Esta configuración es segura para subir al repositorio porque no contiene claves privadas

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Esta configuración la obtuviste de Firebase Console - es PÚBLICA y segura
const firebaseConfig = {
  apiKey: "AIzaSyBuz4DflRR7YzTlwP3-ZpNBGeniEcOXR7w",
  authDomain: "apt-cubist-368817.firebaseapp.com", 
  projectId: "apt-cubist-368817",
  storageBucket: "apt-cubist-368817.firebasestorage.app",
  messagingSenderId: "166554040569",
  appId: "1:166554040569:web:127e5dc87a52e61f300a28"
};

// Inicializamos Firebase para el frontend
const app = initializeApp(firebaseConfig);

// Servicios que usaremos en DocuValle
export const auth = getAuth(app);      // Para login/registro de usuarios
export const db = getFirestore(app);   // Para guardar información de documentos
export const storage = getStorage(app); // Para subir archivos temporalmente

// URL del backend que se desplegará en Cloud Run
// Cloud Build la configurará automáticamente en el proceso de build
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

export default app;