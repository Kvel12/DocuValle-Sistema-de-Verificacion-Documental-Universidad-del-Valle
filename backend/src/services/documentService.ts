// Servicio especializado en manejo de documentos y almacenamiento

import { db, storage } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

// Definimos la estructura de datos que DocuValle maneja
export interface DocumentoProcessado {
  id: string;
  userId: string;
  nombreArchivo: string;
  tipoArchivo: string;
  tamanoArchivo: number;
  archivoUrl: string;
  textoExtraido: string;
  fechaProcesamiento: Date;
  estado: 'procesando' | 'completado' | 'error';
  // Agregamos campos para el análisis de autenticidad (HU005)
  scoreAutenticidad?: number;
  recomendacion?: 'accept' | 'review' | 'reject';
  elementosSeguridad?: {
    sellos: boolean;
    firmas: boolean;
    logos: boolean;
  };
  metadatos?: {
    numeroCaracteres: number;
    numeroPalabras: number;
    numeroLineas: number;
    calidad: 'alta' | 'media' | 'baja';
  };
}

export class DocumentService {
  private bucket: any;
  private bucketName: string = 'apt-cubist-368817.firebasestorage.app';

  constructor() {
    try {
      // Obtenemos referencia al bucket específico de Cloud Storage
      this.bucket = storage.bucket(this.bucketName);
      console.log(`📁 Document Service inicializado con bucket: ${this.bucketName}`);
    } catch (error) {
      console.error('❌ Error inicializando DocumentService:', error);
      throw new Error('Error inicializando el servicio de documentos');
    }
  }

  /**
   * Sube un archivo a Cloud Storage
   * VERSIÓN MEJORADA para HU004 con mejor manejo de errores
   * 
   * @param file - Archivo recibido del frontend (viene de multer)
   * @param procesamientoId - ID único para organizar los archivos
   * @returns Promise<string> - URL pública del archivo subido
   */
  async uploadFile(file: Express.Multer.File, procesamientoId: string): Promise<string> {
    try {
      console.log(`📤 [DocumentService] Iniciando upload de: ${file.originalname}`);
      
      // Validaciones de entrada
      if (!file || !file.buffer) {
        throw new Error('Archivo no válido o vacío');
      }

      if (!procesamientoId) {
        throw new Error('ID de procesamiento requerido');
      }

      // Creamos un nombre único y organizado para el archivo
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const extension = this.obtenerExtension(file.originalname);
      const nombreSanitizado = this.sanitizarNombreArchivo(file.originalname);
      const nombreArchivoStorage = `documentos/${timestamp}/${procesamientoId}_${nombreSanitizado}`;

      console.log(`📂 Nombre en storage: ${nombreArchivoStorage}`);

      // Verificamos que el bucket existe
      const [bucketExists] = await this.bucket.exists();
      if (!bucketExists) {
        throw new Error(`Bucket ${this.bucketName} no existe. Verifica la configuración de Firebase.`);
      }

      // Creamos referencia al archivo en Cloud Storage
      const archivoStorage = this.bucket.file(nombreArchivoStorage);

      // Configuramos las opciones de subida
      const stream = archivoStorage.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          cacheControl: 'public, max-age=31536000', // Cache por 1 año
          metadata: {
            // Metadatos personalizados para DocuValle
            originalName: file.originalname,
            uploadDate: new Date().toISOString(),
            procesamientoId: procesamientoId,
            uploadedBy: 'docuvalle-backend',
            fileSize: file.size.toString()
          }
        },
        // Hacemos el archivo públicamente legible
        public: true,
        // Validamos la integridad del archivo
        validation: 'md5'
      });

      // Subimos el archivo como una promesa
      return new Promise((resolve, reject) => {
        // Timeout de 60 segundos para uploads grandes
        const timeout = setTimeout(() => {
          reject(new Error('Timeout subiendo archivo (60s)'));
        }, 60000);

        stream.on('error', (error: Error) => {
          clearTimeout(timeout);
          console.error(`❌ Error en stream de upload: ${error.message}`);
          reject(new Error(`Error subiendo archivo: ${error.message}`));
        });

        stream.on('finish', async () => {
          clearTimeout(timeout);
          try {
            // Verificamos que el archivo se subió correctamente
            const [exists] = await archivoStorage.exists();
            if (!exists) {
              throw new Error('El archivo no se guardó correctamente en Cloud Storage');
            }

            // Obtenemos la URL pública
            const urlPublica = `https://storage.googleapis.com/${this.bucketName}/${nombreArchivoStorage}`;
            
            console.log(`✅ Archivo subido exitosamente: ${urlPublica}`);
            resolve(urlPublica);
          } catch (error) {
            console.error(`❌ Error verificando archivo subido: ${error}`);
            reject(error);
          }
        });

        // Escribimos los datos del archivo al stream
        stream.end(file.buffer);
      });

    } catch (error) {
      console.error('❌ Error en uploadFile:', error);
      
      // Proporcionamos errores más específicos
      if (error instanceof Error) {
        if (error.message.includes('bucket')) {
          throw new Error('Error de configuración de Cloud Storage. Verifica que el bucket existe y tienes permisos.');
        } else if (error.message.includes('permission')) {
          throw new Error('Error de permisos en Cloud Storage. Verifica la configuración de IAM.');
        } else {
          throw new Error(`Error subiendo archivo: ${error.message}`);
        }
      }
      
      throw new Error('Error desconocido subiendo archivo');
    }
  }

  /**
   * Guarda los resultados del procesamiento en Firestore
   * VERSIÓN MEJORADA con campos para análisis de autenticidad
   */
  async saveProcessingResult(documento: DocumentoProcessado): Promise<string> {
    try {
      console.log(`💾 [DocumentService] Guardando resultado: ${documento.id}`);

      // Validaciones de entrada
      if (!documento.id || !documento.userId) {
        throw new Error('ID de documento y userId son obligatorios');
      }

      // Calculamos metadatos adicionales del texto extraído
      const metadatos = this.calcularMetadatos(documento.textoExtraido);

      // Preparamos el documento para Firestore
      const documentoFirestore = {
        id: documento.id,
        userId: documento.userId,
        nombreArchivo: documento.nombreArchivo,
        tipoArchivo: documento.tipoArchivo,
        tamanoArchivo: documento.tamanoArchivo,
        archivoUrl: documento.archivoUrl,
        fechaProcesamiento: documento.fechaProcesamiento,
        estado: documento.estado,
        
        // Campos para análisis de autenticidad (HU005)
        scoreAutenticidad: documento.scoreAutenticidad || 0,
        recomendacion: documento.recomendacion || 'review',
        elementosSeguridad: documento.elementosSeguridad || {
          sellos: false,
          firmas: false,
          logos: false
        },
        
        metadatos: {
          ...metadatos,
          ...documento.metadatos
        },
        // Solo guardamos una vista previa del texto en el documento principal
        textoPreview: documento.textoExtraido.substring(0, 500),
        textoCompleto: documento.textoExtraido.length > 500 // Indicador si hay más texto
      };

      // Guardamos en la colección principal de documentos
      await db.collection('documentos').doc(documento.id).set(documentoFirestore);

      // Si el texto es largo, lo guardamos por separado para optimizar las consultas
      if (documento.textoExtraido.length > 500) {
        await db.collection('textos-completos').doc(documento.id).set({
          documentoId: documento.id,
          textoCompleto: documento.textoExtraido,
          fechaGuardado: new Date()
        });
      }

      console.log(`✅ Documento guardado exitosamente en Firestore: ${documento.id}`);
      return documento.id;

    } catch (error) {
      console.error('❌ Error guardando en Firestore:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          throw new Error('Error de permisos en Firestore. Verifica la configuración de IAM.');
        } else if (error.message.includes('quota')) {
          throw new Error('Se ha excedido la cuota de Firestore.');
        } else {
          throw new Error(`Error guardando resultado: ${error.message}`);
        }
      }
      
      throw new Error('Error desconocido guardando en Firestore');
    }
  }

  /**
   * Obtiene todos los documentos de un usuario específico
   */
  async getUserDocuments(userId: string): Promise<DocumentoProcessado[]> {
    try {
      console.log(`🔍 [DocumentService] Buscando documentos del usuario: ${userId}`);

      if (!userId) {
        throw new Error('userId es obligatorio');
      }

      // Consultamos Firestore ordenando por fecha más reciente primero
      const snapshot = await db
        .collection('documentos')
        .where('userId', '==', userId)
        .orderBy('fechaProcesamiento', 'desc')
        .limit(50) // Limitamos a 50 documentos más recientes
        .get();

      const documentos: DocumentoProcessado[] = [];

      // Convertimos cada documento de Firestore a nuestro formato
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        documentos.push({
          id: data.id,
          userId: data.userId,
          nombreArchivo: data.nombreArchivo,
          tipoArchivo: data.tipoArchivo,
          tamanoArchivo: data.tamanoArchivo,
          archivoUrl: data.archivoUrl,
          textoExtraido: data.textoPreview || '', // Solo la vista previa por defecto
          fechaProcesamiento: data.fechaProcesamiento.toDate(),
          estado: data.estado,
          scoreAutenticidad: data.scoreAutenticidad,
          recomendacion: data.recomendacion,
          elementosSeguridad: data.elementosSeguridad,
          metadatos: data.metadatos
        });
      });

      console.log(`✅ Encontrados ${documentos.length} documentos para el usuario ${userId}`);
      return documentos;

    } catch (error) {
      console.error('❌ Error obteniendo documentos del usuario:', error);
      throw new Error(`Error obteniendo documentos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Método para probar la conectividad con Cloud Storage
   * Útil para debugging
   */
  async testStorageConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🧪 [DocumentService] Probando conexión con Cloud Storage...');

      // Verificamos que el bucket existe
      const [bucketExists] = await this.bucket.exists();
      
      if (!bucketExists) {
        return {
          success: false,
          message: `Bucket ${this.bucketName} no existe`
        };
      }

      // Obtenemos metadatos del bucket
      const [metadata] = await this.bucket.getMetadata();
      
      return {
        success: true,
        message: 'Cloud Storage conectado correctamente',
        details: {
          bucketName: this.bucketName,
          location: metadata.location,
          storageClass: metadata.storageClass,
          created: metadata.timeCreated
        }
      };
      
    } catch (error) {
      console.error('❌ Error probando Cloud Storage:', error);
      return {
        success: false,
        message: `Error conectando con Cloud Storage: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }

  /**
   * Obtiene el texto completo de un documento específico
   */
  async getTextoCompleto(documentoId: string): Promise<string> {
    try {
      // Primero intentamos obtener el texto de la colección principal
      const docPrincipal = await db.collection('documentos').doc(documentoId).get();
      
      if (!docPrincipal.exists) {
        throw new Error('Documento no encontrado');
      }

      const data = docPrincipal.data();
      
      // Si el texto completo está en el documento principal, lo devolvemos
      if (!data?.textoCompleto) {
        return data?.textoPreview || '';
      }

      // Si es un documento largo, obtenemos el texto de la colección separada
      const docTextoCompleto = await db.collection('textos-completos').doc(documentoId).get();
      
      if (docTextoCompleto.exists) {
        return docTextoCompleto.data()?.textoCompleto || data?.textoPreview || '';
      }

      return data?.textoPreview || '';

    } catch (error) {
      console.error('❌ Error obteniendo texto completo:', error);
      throw new Error(`Error obteniendo texto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Calcula metadatos útiles del texto extraído
   */
  private calcularMetadatos(texto: string) {
    const palabras = texto.split(/\s+/).filter(palabra => palabra.length > 0);
    const lineas = texto.split('\n').filter(linea => linea.trim().length > 0);
    
    const metadatos = {
      numeroCaracteres: texto.length,
      numeroPalabras: palabras.length,
      numeroLineas: lineas.length,
      promedioCaracteresPorPalabra: palabras.length > 0 ? Math.round((texto.length / palabras.length) * 100) / 100 : 0,
      promedioPalabrasPorLinea: lineas.length > 0 ? Math.round((palabras.length / lineas.length) * 100) / 100 : 0,
      calidad: this.determinarCalidadTexto(palabras.length, texto.length) as 'alta' | 'media' | 'baja'
    };

    return metadatos;
  }

  /**
   * Determina la calidad del texto extraído basado en métricas
   */
  private determinarCalidadTexto(palabras: number, caracteres: number): string {
    if (palabras > 100 && caracteres > 500) {
      return 'alta';
    } else if (palabras > 20 && caracteres > 100) {
      return 'media';
    } else {
      return 'baja';
    }
  }

  /**
   * Obtiene la extensión de un archivo de forma segura
   */
  private obtenerExtension(nombreArchivo: string): string {
    const ultimoPunto = nombreArchivo.lastIndexOf('.');
    return ultimoPunto > 0 ? nombreArchivo.substring(ultimoPunto + 1).toLowerCase() : '';
  }

  /**
   * Sanitiza el nombre del archivo para Cloud Storage
   */
  private sanitizarNombreArchivo(nombreArchivo: string): string {
    // Reemplazamos caracteres especiales por guiones bajos
    return nombreArchivo
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_'); // Reemplazamos múltiples guiones bajos por uno solo
  }

  /**
   * Elimina un documento y su archivo asociado
   * Útil para limpiar documentos que ya no se necesitan
   */
  async eliminarDocumento(documentoId: string, userId: string): Promise<void> {
    try {
      // Verificamos que el documento pertenezca al usuario
      const doc = await db.collection('documentos').doc(documentoId).get();
      
      if (!doc.exists) {
        throw new Error('Documento no encontrado');
      }

      const data = doc.data();
      if (data?.userId !== userId) {
        throw new Error('No tienes permisos para eliminar este documento');
      }

      // Eliminamos el archivo de Cloud Storage
      const archivoUrl = data?.archivoUrl;
      if (archivoUrl) {
        try {
          // Extraemos el nombre del archivo de la URL
          const nombreArchivo = archivoUrl.split(`${this.bucketName}/`)[1];
          if (nombreArchivo) {
            const archivo = this.bucket.file(nombreArchivo);
            await archivo.delete();
            console.log(`🗑️ Archivo eliminado de Storage: ${nombreArchivo}`);
          }
        } catch (storageError) {
          console.warn(`⚠️ No se pudo eliminar archivo de Storage: ${storageError}`);
          // Continuamos con la eliminación en Firestore aunque falle el Storage
        }
      }

      // Eliminamos los registros de Firestore
      await db.collection('documentos').doc(documentoId).delete();
      
      // Intentamos eliminar texto completo si existe
      try {
        await db.collection('textos-completos').doc(documentoId).delete();
      } catch (textError) {
        console.warn(`⚠️ No se encontró texto completo para eliminar: ${textError}`);
      }

      console.log(`🗑️ Documento eliminado exitosamente: ${documentoId}`);

    } catch (error) {
      console.error('❌ Error eliminando documento:', error);
      throw new Error(`Error eliminando documento: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
}