// Aplicación principal de DocuValle Frontend
// Esta es la página que los usuarios verán para probar todas las funcionalidades

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { API_BASE_URL } from './src/config/firebase';
import './App.css';

// Definimos las interfaces para mantener el código organizado y tipado
interface ResultadoProcesamiento {
  success: boolean;
  message: string;
  resultado?: {
    id: string;
    textoExtraido: string;
    numeroCaracteres: number;
    archivoUrl: string;
  };
  error?: string;
}

interface EstadoConexion {
  backend: 'checking' | 'connected' | 'error';
  firebase: 'checking' | 'connected' | 'error';
  vision: 'checking' | 'connected' | 'error';
}

function App() {
  // Estados para manejar la interfaz de usuario
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoProcesamiento | null>(null);
  const [estadoConexiones, setEstadoConexiones] = useState<EstadoConexion>({
    backend: 'checking',
    firebase: 'checking', 
    vision: 'checking'
  });

  // Configuración de react-dropzone para arrastrar y soltar archivos
  // Es como crear una zona especial donde los usuarios pueden "soltar" sus documentos
  const onDrop = useCallback((archivosAceptados: File[]) => {
    if (archivosAceptados.length > 0) {
      setArchivo(archivosAceptados[0]);
      setResultado(null); // Limpiamos resultados anteriores
      console.log('📄 Archivo seleccionado:', archivosAceptados[0].name);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024 // 50MB máximo
  });

  // Función para probar todas las conexiones del sistema
  // Es como hacer un chequeo médico completo a DocuValle
  const probarConexiones = async () => {
    setEstadoConexiones({
      backend: 'checking',
      firebase: 'checking',
      vision: 'checking'
    });

    try {
      // Prueba 1: Verificar que el backend responde
      console.log('🔍 Probando conexión con backend...');
      const healthCheck = await axios.get(`${API_BASE_URL}/api/health`, { timeout: 10000 });
      
      if (healthCheck.data.status === 'ok') {
        setEstadoConexiones(prev => ({ ...prev, backend: 'connected' }));
        console.log('✅ Backend conectado correctamente');
      } else {
        throw new Error('Backend no responde correctamente');
      }

      // Prueba 2: Verificar conexión con Firebase
      console.log('🔍 Probando conexión con Firebase...');
      const firebaseTest = await axios.get(`${API_BASE_URL}/api/test-firebase`, { timeout: 15000 });
      
      if (firebaseTest.data.success) {
        setEstadoConexiones(prev => ({ ...prev, firebase: 'connected' }));
        console.log('✅ Firebase conectado correctamente');
      } else {
        throw new Error('Firebase no responde correctamente');
      }

      // Prueba 3: Verificar Vision API
      console.log('🔍 Probando conexión con Vision API...');
      const visionTest = await axios.get(`${API_BASE_URL}/api/test-vision`, { timeout: 20000 });
      
      if (visionTest.data.success) {
        setEstadoConexiones(prev => ({ ...prev, vision: 'connected' }));
        console.log('✅ Vision API conectado correctamente');
      } else {
        throw new Error('Vision API no responde correctamente');
      }

    } catch (error) {
      console.error('❌ Error en las pruebas de conexión:', error);
      
      // Marcamos como error el servicio que falló
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
          setEstadoConexiones(prev => ({ ...prev, backend: 'error' }));
        } else if (error.response?.status === 500 && error.config?.url?.includes('firebase')) {
          setEstadoConexiones(prev => ({ ...prev, firebase: 'error' }));
        } else if (error.config?.url?.includes('vision')) {
          setEstadoConexiones(prev => ({ ...prev, vision: 'error' }));
        }
      }
    }
  };

  // Función principal para procesar documentos
  // Esta es la funcionalidad central de DocuValle
  const procesarDocumento = async () => {
    if (!archivo) {
      alert('Por favor selecciona un archivo primero');
      return;
    }

    setProcesando(true);
    setResultado(null);

    try {
      console.log(`📤 Enviando documento: ${archivo.name} (${archivo.size} bytes)`);

      // Preparamos el archivo para enviar al backend
      // FormData es como preparar un sobre con el documento adentro
      const formData = new FormData();
      formData.append('archivo', archivo);
      formData.append('userId', 'usuario-prueba'); // En producción esto vendrá de la autenticación

      // Enviamos el documento al backend para procesamiento
      const respuesta = await axios.post(
        `${API_BASE_URL}/api/procesar-documento`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 60 segundos de timeout - el procesamiento puede tardar
        }
      );

      setResultado(respuesta.data);
      console.log('🎉 Documento procesado exitosamente:', respuesta.data);

    } catch (error) {
      console.error('❌ Error procesando documento:', error);
      
      let mensajeError = 'Error desconocido procesando el documento';
      
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.message) {
          mensajeError = error.response.data.message;
        } else if (error.code === 'ECONNREFUSED') {
          mensajeError = 'No se puede conectar con el servidor. Verifique que el backend esté funcionando.';
        } else if (error.code === 'ECONNABORTED') {
          mensajeError = 'El procesamiento está tardando más de lo esperado. Intente con un archivo más pequeño.';
        }
      }

      setResultado({
        success: false,
        message: mensajeError,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    } finally {
      setProcesando(false);
    }
  };

  // Función para obtener el color del indicador según el estado
  const obtenerColorEstado = (estado: 'checking' | 'connected' | 'error'): string => {
    switch (estado) {
      case 'checking': return '#ffa500'; // Naranja para "verificando"
      case 'connected': return '#4caf50'; // Verde para "conectado"
      case 'error': return '#f44336'; // Rojo para "error"
      default: return '#grey';
    }
  };

  // Función para obtener el texto del estado
  const obtenerTextoEstado = (estado: 'checking' | 'connected' | 'error'): string => {
    switch (estado) {
      case 'checking': return 'Verificando...';
      case 'connected': return 'Conectado ✅';
      case 'error': return 'Error ❌';
      default: return 'Desconocido';
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 DocuValle - Prueba de Sistema</h1>
        <p>
          Procesamiento inteligente de documentos con Google Cloud Vision API
        </p>
      </header>

      <main className="App-main">
        {/* Panel de estado de conexiones */}
        <section className="conexiones-panel">
          <h2>🔍 Estado de Conexiones</h2>
          <button onClick={probarConexiones} className="btn-probar">
            Probar Todas las Conexiones
          </button>
          
          <div className="estado-grid">
            <div className="estado-item">
              <span 
                className="estado-indicador"
                style={{ backgroundColor: obtenerColorEstado(estadoConexiones.backend) }}
              ></span>
              <strong>Backend (Cloud Run):</strong> {obtenerTextoEstado(estadoConexiones.backend)}
            </div>
            
            <div className="estado-item">
              <span 
                className="estado-indicador"
                style={{ backgroundColor: obtenerColorEstado(estadoConexiones.firebase) }}
              ></span>
              <strong>Firebase (Firestore):</strong> {obtenerTextoEstado(estadoConexiones.firebase)}
            </div>
            
            <div className="estado-item">
              <span 
                className="estado-indicador"
                style={{ backgroundColor: obtenerColorEstado(estadoConexiones.vision) }}
              ></span>
              <strong>Vision API (OCR):</strong> {obtenerTextoEstado(estadoConexiones.vision)}
            </div>
          </div>
        </section>

        {/* Panel de subida de archivos */}
        <section className="upload-panel">
          <h2>📄 Procesar Documento</h2>
          
          <div 
            {...getRootProps()} 
            className={`dropzone ${isDragActive ? 'activa' : ''} ${archivo ? 'con-archivo' : ''}`}
          >
            <input {...getInputProps()} />
            {archivo ? (
              <div className="archivo-seleccionado">
                <h3>📁 Archivo seleccionado:</h3>
                <p><strong>Nombre:</strong> {archivo.name}</p>
                <p><strong>Tamaño:</strong> {(archivo.size / 1024 / 1024).toFixed(2)} MB</p>
                <p><strong>Tipo:</strong> {archivo.type}</p>
                <button onClick={() => setArchivo(null)} className="btn-limpiar">
                  Seleccionar otro archivo
                </button>
              </div>
            ) : (
              <div className="zona-dropzone">
                {isDragActive ? (
                  <p>🎯 Suelta el archivo aquí...</p>
                ) : (
                  <div>
                    <p>📎 Arrastra un archivo aquí, o haz clic para seleccionar</p>
                    <small>Formatos aceptados: JPG, PNG, PDF (máximo 50MB)</small>
                  </div>
                )}
              </div>
            )}
          </div>

          {archivo && (
            <button 
              onClick={procesarDocumento} 
              disabled={procesando}
              className={`btn-procesar ${procesando ? 'procesando' : ''}`}
            >
              {procesando ? '⏳ Procesando...' : '🚀 Procesar Documento'}
            </button>
          )}
        </section>

        {/* Panel de resultados */}
        {resultado && (
          <section className="resultados-panel">
            <h2>📊 Resultados del Procesamiento</h2>
            
            {resultado.success ? (
              <div className="resultado-exitoso">
                <h3>✅ {resultado.message}</h3>
                {resultado.resultado && (
                  <div className="detalles-resultado">
                    <p><strong>ID del procesamiento:</strong> {resultado.resultado.id}</p>
                    <p><strong>Caracteres extraídos:</strong> {resultado.resultado.numeroCaracteres}</p>
                    <p><strong>Archivo guardado en:</strong> 
                      <a href={resultado.resultado.archivoUrl} target="_blank" rel="noopener noreferrer">
                        Ver archivo original
                      </a>
                    </p>
                    
                    <div className="texto-extraido">
                      <h4>📝 Texto extraído (vista previa):</h4>
                      <textarea 
                        value={resultado.resultado.textoExtraido} 
                        readOnly 
                        rows={10}
                        className="textarea-resultado"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="resultado-error">
                <h3>❌ {resultado.message}</h3>
                {resultado.error && (
                  <details className="detalles-error">
                    <summary>Ver detalles del error</summary>
                    <pre>{resultado.error}</pre>
                  </details>
                )}
              </div>
            )}
          </section>
        )}

        {/* Información adicional */}
        <section className="info-panel">
          <h2>ℹ️ Información de la Prueba</h2>
          <div className="info-grid">
            <div className="info-item">
              <h3>🔧 Servicios Configurados</h3>
              <ul>
                <li>Frontend: React + Firebase Hosting</li>
                <li>Backend: Node.js + Cloud Run</li>
                <li>Base de datos: Firestore</li>
                <li>Almacenamiento: Cloud Storage</li>
                <li>OCR: Google Cloud Vision API</li>
                <li>CI/CD: Cloud Build</li>
              </ul>
            </div>
            
            <div className="info-item">
              <h3>📋 Qué probar</h3>
              <ol>
                <li>Haz clic en "Probar Todas las Conexiones"</li>
                <li>Sube una imagen con texto o un PDF</li>
                <li>Procesa el documento</li>
                <li>Revisa el texto extraído</li>
                <li>Verifica que se guardó en Cloud Storage</li>
              </ol>
            </div>
          </div>
        </section>
      </main>

      <footer className="App-footer">
        <p>
          🏗️ DocuValle v1.0.0 - Prueba de integración completa<br/>
          Proyecto: apt-cubist-368817 | Región: us-central1
        </p>
      </footer>
    </div>
  );
}

export default App;