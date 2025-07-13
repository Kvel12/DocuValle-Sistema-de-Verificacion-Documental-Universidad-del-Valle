// Servicio especializado en manejo de documentos y almacenamiento
// Versión mejorada con soporte para análisis visual y mejores metadatos

import { db, storage } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

// Interfaz expandida para documentos procesados con análisis visual
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
  
  // Campos para el análisis de autenticidad (HU005)
  scoreAutenticidad?: number;
  recomendacion?: 'accept' | 'review' | 'reject';
  elementosSeguridad?: {
    sellos: boolean;
    firmas: boolean;
    logos: boolean;
  };
  
  // Metadatos expandidos para análisis visual
  metadatos?: {
    numeroCaracteres: number;
    numeroPalabras: number;
    numeroLineas: number;
    calidad: 'alta' | 'media' | 'baja';
    
    // Nuevos campos para análisis visual
    objetosDetectados?: number;
    logosProcesados?: string[];
    sellosProcesados?: string[];
    firmasProcesadas?: string[];
    resolucionImagen?: 'alta' | 'media' | 'baja';
    estructuraDocumento?: 'formal' | 'informal' | 'dudosa';
    confianzaPromedio?: number;
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
   * VERSIÓN MEJORADA con mejor organización para PDFs e imágenes
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

      // Creamos un nombre único y organizado por tipo
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const extension = this.obtenerExtension(file.originalname);
      const nombreSanitizado = this.sanitizarNombreArchivo(file.originalname);
      
      // Organizamos por tipo de archivo para mejor gestión
      const carpetaTipo = this.determinarCarpetaPorTipo(file.mimetype);
      const nombreArchivoStorage = `documentos/${carpetaTipo}/${timestamp}/${procesamientoId}_${nombreSanitizado}`;

      console.log(`📂 Nombre en storage: ${nombreArchivoStorage}`);

      // Verificamos que el bucket existe
      const [bucketExists] = await this.bucket.exists();
      if (!bucketExists) {
        throw new Error(`Bucket ${this.bucketName} no existe. Verifica la configuración de Firebase.`);
      }

      // Validación adicional para PDFs
      if (file.mimetype === 'application/pdf') {
        await this.validarPDF(file.buffer);
      }

      // Creamos referencia al archivo en Cloud Storage
      const archivoStorage = this.bucket.file(nombreArchivoStorage);

      // Configuramos las opciones de subida mejoradas
      const stream = archivoStorage.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          cacheControl: 'public, max-age=31536000', // Cache por 1 año
          metadata: {
            // Metadatos personalizados ampliados
            originalName: file.originalname,
            uploadDate: new Date().toISOString(),
            procesamientoId: procesamientoId,
            uploadedBy: 'docuvalle-backend',
            fileSize: file.size.toString(),
            fileExtension: extension,
            documentType: this.determinarTipoDocumento(file.originalname),
            version: '2.0'
          }
        },
        public: true,
        validation: 'md5',
        // Configuración optimizada según el tipo de archivo
        resumable: file.size > 5 * 1024 * 1024 // Resumable para archivos > 5MB
      });

      // Subimos el archivo como una promesa
      return new Promise((resolve, reject) => {
        // Timeout ajustado según el tamaño del archivo
        const timeoutMs = Math.max(60000, file.size / 1024); // Mínimo 60s, +1s por KB
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout subiendo archivo (${timeoutMs/1000}s)`));
        }, timeoutMs);

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
        } else if (error.message.includes('PDF corrupto')) {
          throw new Error('El archivo PDF está corrupto o no es válido.');
        } else {
          throw new Error(`Error subiendo archivo: ${error.message}`);
        }
      }
      
      throw new Error('Error desconocido subiendo archivo');
    }
  }

  /**
   * Guarda los resultados del procesamiento en Firestore
   * VERSIÓN MEJORADA con campos expandidos para análisis visual
   */
  async saveProcessingResult(documento: DocumentoProcessado): Promise<string> {
    try {
      console.log(`💾 [DocumentService] Guardando resultado mejorado: ${documento.id}`);

      // Validaciones de entrada
      if (!documento.id || !documento.userId) {
        throw new Error('ID de documento y userId son obligatorios');
      }

      // Calculamos metadatos mejorados del texto extraído
      const metadatos = this.calcularMetadatosAvanzados(documento.textoExtraido, documento.metadatos);

      // Preparamos el documento para Firestore con campos expandidos
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
        
        // Metadatos expandidos con información del análisis visual
        metadatos: metadatos,
        
        // Solo guardamos una vista previa del texto en el documento principal
        textoPreview: documento.textoExtraido.substring(0, 500),
        textoCompleto: documento.textoExtraido.length > 500, // Indicador si hay más texto
        
        // Campos adicionales para búsqueda y filtrado
        tipoDocumentoDetectado: this.detectarTipoDocumentoPorTexto(documento.textoExtraido),
        palabrasClave: this.extraerPalabrasClave(documento.textoExtraido),
        
        // Información de la versión del algoritmo
        versionAnalisis: '2.0',
        fechaUltimaActualizacion: new Date()
      };

      // Guardamos en la colección principal de documentos
      await db.collection('documentos').doc(documento.id).set(documentoFirestore);

      // Si el texto es largo, lo guardamos por separado para optimizar las consultas
      if (documento.textoExtraido.length > 500) {
        await db.collection('textos-completos').doc(documento.id).set({
          documentoId: documento.id,
          textoCompleto: documento.textoExtraido,
          fechaGuardado: new Date(),
          checksum: this.calcularChecksum(documento.textoExtraido) // Para verificar integridad
        });
      }

      // Guardamos estadísticas para el dashboard
      await this.actualizarEstadisticas(documento);

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
   * VERSIÓN MEJORADA con más opciones de filtrado
   */
  async getUserDocuments(userId: string, filtros?: {
    limite?: number;
    tipoDocumento?: string;
    recomendacion?: string;
    fechaDesde?: Date;
    fechaHasta?: Date;
  }): Promise<DocumentoProcessado[]> {
    try {
      console.log(`🔍 [DocumentService] Buscando documentos del usuario: ${userId}`);

      if (!userId) {
        throw new Error('userId es obligatorio');
      }

      // Construimos la consulta base
      let consulta = db
        .collection('documentos')
        .where('userId', '==', userId);

      // Aplicamos filtros adicionales si existen
      if (filtros?.tipoDocumento) {
        consulta = consulta.where('tipoDocumentoDetectado', '==', filtros.tipoDocumento);
      }

      if (filtros?.recomendacion) {
        consulta = consulta.where('recomendacion', '==', filtros.recomendacion);
      }

      if (filtros?.fechaDesde) {
        consulta = consulta.where('fechaProcesamiento', '>=', filtros.fechaDesde);
      }

      if (filtros?.fechaHasta) {
        consulta = consulta.where('fechaProcesamiento', '<=', filtros.fechaHasta);
      }

      // Ordenamos y limitamos
      consulta = consulta
        .orderBy('fechaProcesamiento', 'desc')
        .limit(filtros?.limite || 50);

      const snapshot = await consulta.get();
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
   * Obtiene estadísticas del dashboard
   */
  async obtenerEstadisticasDashboard(userId?: string): Promise<{
    totalDocumentos: number;
    documentosHoy: number;
    scorePromedio: number;
    distribucionRecomendaciones: { [key: string]: number };
    tiposDocumentosMasComunes: { [key: string]: number };
    tendenciaUltimos30Dias: Array<{ fecha: string; cantidad: number }>;
  }> {
    try {
      console.log('📊 Calculando estadísticas del dashboard...');

      let consultaBase = db.collection('documentos');
      
      if (userId) {
        consultaBase = consultaBase.where('userId', '==', userId);
      }

      // Total de documentos
      const snapshotTotal = await consultaBase.get();
      const totalDocumentos = snapshotTotal.size;

      // Documentos de hoy
      const inicioHoy = new Date();
      inicioHoy.setHours(0, 0, 0, 0);
      const snapshotHoy = await consultaBase
        .where('fechaProcesamiento', '>=', inicioHoy)
        .get();
      const documentosHoy = snapshotHoy.size;

      // Calculamos estadísticas de los documentos
      let sumaScores = 0;
      let contadorScores = 0;
      const distribucionRecomendaciones: { [key: string]: number } = {};
      const tiposDocumentosMasComunes: { [key: string]: number } = {};

      snapshotTotal.forEach((doc: any) => {
        const data = doc.data();
        
        // Score promedio
        if (data.scoreAutenticidad !== undefined) {
          sumaScores += data.scoreAutenticidad;
          contadorScores++;
        }

        // Distribución de recomendaciones
        const recomendacion = data.recomendacion || 'sin_determinar';
        distribucionRecomendaciones[recomendacion] = (distribucionRecomendaciones[recomendacion] || 0) + 1;

        // Tipos de documento más comunes
        const tipoDetectado = data.tipoDocumentoDetectado || 'no_determinado';
        tiposDocumentosMasComunes[tipoDetectado] = (tiposDocumentosMasComunes[tipoDetectado] || 0) + 1;
      });

      const scorePromedio = contadorScores > 0 ? Math.round((sumaScores / contadorScores) * 100) / 100 : 0;

      // Tendencia de últimos 30 días
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      
      const snapshotTendencia = await consultaBase
        .where('fechaProcesamiento', '>=', hace30Dias)
        .orderBy('fechaProcesamiento', 'asc')
        .get();

      const tendenciaUltimos30Dias = this.procesarTendencia(snapshotTendencia);

      return {
        totalDocumentos,
        documentosHoy,
        scorePromedio,
        distribucionRecomendaciones,
        tiposDocumentosMasComunes,
        tendenciaUltimos30Dias
      };

    } catch (error) {
      console.error('❌ Error calculando estadísticas:', error);
      throw new Error(`Error obteniendo estadísticas: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Método para probar la conectividad con Cloud Storage
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
   * FUNCIONES AUXILIARES MEJORADAS
   */

  /**
   * Calcula metadatos avanzados del texto extraído
   */
  private calcularMetadatosAvanzados(texto: string, metadatosExistentes?: any) {
    const palabras = texto.split(/\s+/).filter(palabra => palabra.length > 0);
    const lineas = texto.split('\n').filter(linea => linea.trim().length > 0);
    
    const metadatos = {
      numeroCaracteres: texto.length,
      numeroPalabras: palabras.length,
      numeroLineas: lineas.length,
      promedioCaracteresPorPalabra: palabras.length > 0 ? Math.round((texto.length / palabras.length) * 100) / 100 : 0,
      promedioPalabrasPorLinea: lineas.length > 0 ? Math.round((palabras.length / lineas.length) * 100) / 100 : 0,
      calidad: this.determinarCalidadTexto(palabras.length, texto.length) as 'alta' | 'media' | 'baja',
      
      // Nuevos campos de metadatos existentes si los hay
      objetosDetectados: metadatosExistentes?.objetosDetectados || 0,
      logosProcesados: metadatosExistentes?.logosProcesados || [],
      sellosProcesados: metadatosExistentes?.sellosProcesados || [],
      firmasProcesadas: metadatosExistentes?.firmasProcesadas || [],
      resolucionImagen: metadatosExistentes?.resolucionImagen || 'media',
      estructuraDocumento: metadatosExistentes?.estructuraDocumento || 'informal',
      confianzaPromedio: metadatosExistentes?.confianzaPromedio || 0
    };

    return metadatos;
  }

  /**
   * Determina la carpeta por tipo de archivo
   */
  private determinarCarpetaPorTipo(mimeType: string): string {
    if (mimeType === 'application/pdf') return 'pdfs';
    if (mimeType.startsWith('image/')) return 'imagenes';
    return 'otros';
  }

  /**
   * Determina el tipo de documento por el nombre
   */
  private determinarTipoDocumento(nombreArchivo: string): string {
    const nombreLower = nombreArchivo.toLowerCase();
    
    if (nombreLower.includes('diploma') || nombreLower.includes('titulo')) return 'diploma';
    if (nombreLower.includes('certificado') || nombreLower.includes('certificate')) return 'certificado';
    if (nombreLower.includes('nota') || nombreLower.includes('grade')) return 'notas';
    if (nombreLower.includes('cedula') || nombreLower.includes('id')) return 'identificacion';
    
    return 'documento_general';
  }

  /**
   * Detecta el tipo de documento por el contenido del texto
   */
  private detectarTipoDocumentoPorTexto(texto: string): string {
    const textoLower = texto.toLowerCase();
    
    if (textoLower.includes('diploma') || textoLower.includes('degree')) return 'diploma';
    if (textoLower.includes('certificado') || textoLower.includes('certificate')) return 'certificado';
    if (textoLower.includes('nota') || textoLower.includes('calificacion') || textoLower.includes('grade')) return 'notas';
    if (textoLower.includes('cedula') || textoLower.includes('identificacion')) return 'identificacion';
    if (textoLower.includes('pasaporte') || textoLower.includes('passport')) return 'pasaporte';
    
    return 'documento_general';
  }

  /**
   * Extrae palabras clave del texto para búsqueda
   */
  private extraerPalabrasClave(texto: string): string[] {
    const palabrasRelevantes = [
      'universidad', 'colegio', 'instituto', 'certificate', 'diploma', 'degree',
      'director', 'rector', 'registrar', 'oficial', 'sello', 'firma'
    ];
    
    const textoLower = texto.toLowerCase();
    return palabrasRelevantes.filter(palabra => textoLower.includes(palabra));
  }

  /**
   * Calcula un checksum simple para verificar integridad
   */
  private calcularChecksum(texto: string): string {
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
      const char = texto.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Procesa datos para crear tendencia de 30 días
   */
  private procesarTendencia(snapshot: any): Array<{ fecha: string; cantidad: number }> {
    const contadorPorDia: { [fecha: string]: number } = {};
    
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const fecha = data.fechaProcesamiento.toDate().toISOString().split('T')[0];
      contadorPorDia[fecha] = (contadorPorDia[fecha] || 0) + 1;
    });

    return Object.entries(contadorPorDia)
      .map(([fecha, cantidad]) => ({ fecha, cantidad }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  /**
   * Actualiza estadísticas globales del sistema
   */
  private async actualizarEstadisticas(documento: DocumentoProcessado): Promise<void> {
    try {
      const estadisticasRef = db.collection('estadisticas').doc('globales');
      const fecha = new Date().toISOString().split('T')[0];
      
      await estadisticasRef.set({
        ultimoDocumentoProcesado: documento.id,
        ultimaFechaProcesamiento: new Date(),
        [`documentosPorDia.${fecha}`]: db.FieldValue.increment(1),
        totalDocumentosProcesados: db.FieldValue.increment(1)
      }, { merge: true });
      
    } catch (error) {
      console.warn('⚠️ No se pudieron actualizar estadísticas globales:', error);
      // No es crítico, así que solo loggeamos el warning
    }
  }

  /**
   * Valida que un PDF sea válido
   */
  private async validarPDF(buffer: Buffer): Promise<void> {
    // Verificar que tenga el header PDF
    const header = buffer.slice(0, 5).toString();
    if (!header.startsWith('%PDF-')) {
      throw new Error('PDF corrupto: Header inválido');
    }
    
    // Verificar tamaño mínimo
    if (buffer.length < 100) {
      throw new Error('PDF corrupto: Archivo demasiado pequeño');
    }
  }

  /**
   * Determina la calidad del texto extraído
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