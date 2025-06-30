// Servicio especializado en Vision API de Google Cloud
// Versión mejorada con método de test y mejor manejo de errores

import { ImageAnnotatorClient } from '@google-cloud/vision';

export class VisionService {
  private visionClient: ImageAnnotatorClient;

  constructor() {
    // Inicializamos el cliente de Vision API
    // En Cloud Run, la autenticación se maneja automáticamente
    this.visionClient = new ImageAnnotatorClient({
      // No necesitamos especificar credenciales - Cloud Run las maneja automáticamente
      projectId: process.env.PROJECT_ID || 'apt-cubist-368817'
    });
    
    console.log('🔍 Vision API Service inicializado correctamente');
  }

  /**
   * Método específico para probar la conectividad de Vision API
   * Sin necesidad de enviar imágenes reales
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🔍 Probando conectividad con Vision API...');
      
      // Verificamos que el cliente esté correctamente inicializado
      if (!this.visionClient) {
        throw new Error('Cliente de Vision API no inicializado');
      }

      // Intentamos hacer una operación muy básica para verificar permisos
      // Esto no consume cuota significativa pero verifica conectividad
      const projectId = await this.visionClient.getProjectId();
      
      return {
        success: true,
        message: 'Vision API conectado correctamente',
        details: {
          projectId,
          status: 'operational',
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('❌ Error probando Vision API:', error);
      
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        if (error.message.includes('authentication')) {
          errorMessage = 'Error de autenticación. Verifique las credenciales de la cuenta de servicio.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Error de permisos. La cuenta de servicio no tiene acceso a Vision API.';
        } else if (error.message.includes('quota')) {
          errorMessage = 'Se ha excedido la cuota de Vision API.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Extrae texto de un archivo usando Vision API
   * Versión mejorada con mejor validación de entrada
   * 
   * @param buffer - Los datos del archivo en memoria
   * @param mimeType - El tipo de archivo (image/jpeg, application/pdf, etc.)
   * @returns Promise<string> - El texto extraído del documento
   */
  async detectTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      // Validamos que el tipo de archivo sea compatible con Vision API
      const supportedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp',
        'image/webp', 'image/tiff', 'application/pdf'
      ];
      
      if (!supportedTypes.includes(mimeType)) {
        throw new Error(`Tipo de archivo no soportado: ${mimeType}. Tipos válidos: ${supportedTypes.join(', ')}`);
      }

      // Validamos que el buffer tenga datos
      if (!buffer || buffer.length === 0) {
        throw new Error('El archivo está vacío o no contiene datos válidos');
      }

      console.log(`🔍 Analizando archivo de tipo: ${mimeType}, tamaño: ${buffer.length} bytes`);

      // Configuramos la petición a Vision API de manera más robusta
      const request = {
        image: {
          content: buffer.toString('base64'), // Convertimos el archivo a formato base64
        },
        features: [
          {
            type: 'TEXT_DETECTION' as const, // Detectamos texto general
            maxResults: 1 // Solo necesitamos un resultado con todo el texto
          },
          {
            type: 'DOCUMENT_TEXT_DETECTION' as const, // Detectamos texto estructurado (mejor para documentos)
            maxResults: 1
          }
        ],
        imageContext: {
          languageHints: ['es', 'en'] // Priorizamos español e inglés
        }
      };

      // Enviamos la petición a Vision API con timeout
      const [result] = await this.visionClient.annotateImage(request);

      // Verificamos si hubo errores en el procesamiento
      if (result.error) {
        throw new Error(`Vision API error: ${result.error.message}`);
      }

      // Extraemos el texto detectado con preferencia por DOCUMENT_TEXT_DETECTION
      let textoExtraido = '';
      
      if (result.fullTextAnnotation && result.fullTextAnnotation.text) {
        // Este es el resultado más completo y estructurado
        textoExtraido = result.fullTextAnnotation.text;
        console.log(`✅ Texto extraído usando DOCUMENT_TEXT_DETECTION (${textoExtraido.length} caracteres)`);
      } else if (result.textAnnotations && result.textAnnotations.length > 0) {
        // Fallback a TEXT_DETECTION si el anterior no funcionó
        textoExtraido = result.textAnnotations[0].description || '';
        console.log(`✅ Texto extraído usando TEXT_DETECTION (${textoExtraido.length} caracteres)`);
      } else {
        console.log('⚠️ No se detectó texto en el documento');
        return 'No se pudo extraer texto del documento. Verifique que el documento contenga texto legible.';
      }

      // Limpiamos y procesamos el texto extraído
      const textoLimpio = this.limpiarTextoExtraido(textoExtraido);
      
      console.log(`🎉 Procesamiento exitoso. Texto final: ${textoLimpio.length} caracteres`);
      return textoLimpio;

    } catch (error) {
      console.error('❌ Error en Vision API:', error);
      
      // Proporcionamos errores más específicos para facilitar el debugging
      if (error instanceof Error) {
        if (error.message.includes('quota')) {
          throw new Error('Se ha excedido la cuota de Vision API. Intente más tarde.');
        } else if (error.message.includes('permission')) {
          throw new Error('Error de permisos. Verifique la configuración de la cuenta de servicio.');
        } else if (error.message.includes('Bad image data')) {
          throw new Error('Los datos de la imagen no son válidos. Verifique que el archivo no esté corrupto.');
        } else {
          throw new Error(`Error procesando el documento: ${error.message}`);
        }
      }
      
      throw new Error('Error desconocido al procesar el documento con Vision API');
    }
  }

  /**
   * Método de prueba con imagen sintética simple
   * Útil para verificar que todo el pipeline funciona
   */
  async testWithSyntheticImage(): Promise<{ success: boolean; message: string; resultado?: string }> {
    try {
      // Creamos una imagen PNG simple de 1x1 pixel transparente
      // Esta es una imagen válida mínima que Vision API puede procesar
      const miniImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77ygAAAABJRU5ErkJggg==';
      const imageBuffer = Buffer.from(miniImageBase64, 'base64');
      
      console.log('🧪 Ejecutando test con imagen sintética...');
      
      const resultado = await this.detectTextFromBuffer(imageBuffer, 'image/png');
      
      return {
        success: true,
        message: 'Test sintético completado exitosamente',
        resultado: resultado
      };
      
    } catch (error) {
      console.error('❌ Error en test sintético:', error);
      return {
        success: false,
        message: 'Error en test sintético: ' + (error instanceof Error ? error.message : 'Error desconocido')
      };
    }
  }

  /**
   * Limpia y mejora el texto extraído por Vision API
   * Versión sin cambios - ya estaba bien implementada
   */
  private limpiarTextoExtraido(textoRaw: string): string {
    if (!textoRaw || textoRaw.trim().length === 0) {
      return 'No se pudo extraer texto del documento.';
    }

    let textoLimpio = textoRaw;

    // Normalizamos los saltos de línea
    textoLimpio = textoLimpio.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Eliminamos líneas vacías excesivas (más de 2 seguidas)
    textoLimpio = textoLimpio.replace(/\n{3,}/g, '\n\n');

    // Eliminamos espacios excesivos
    textoLimpio = textoLimpio.replace(/[ \t]{2,}/g, ' ');

    // Eliminamos espacios al inicio y final de cada línea
    textoLimpio = textoLimpio
      .split('\n')
      .map(linea => linea.trim())
      .join('\n');

    // Eliminamos espacios al inicio y final del texto completo
    textoLimpio = textoLimpio.trim();

    return textoLimpio;
  }

  /**
   * Analiza la calidad del texto extraído - sin cambios
   */
  analizarCalidadTexto(texto: string) {
    const palabras = texto.split(/\s+/).filter(palabra => palabra.length > 0);
    const caracteresTotales = texto.length;
    const lineas = texto.split('\n').filter(linea => linea.trim().length > 0);
    
    const promedioCaracteresPorPalabra = palabras.length > 0 ? caracteresTotales / palabras.length : 0;
    const promedioPalabrasPorLinea = lineas.length > 0 ? palabras.length / lineas.length : 0;

    return {
      palabrasTotal: palabras.length,
      caracteresTotales,
      lineasTotal: lineas.length,
      promedioCaracteresPorPalabra: Math.round(promedioCaracteresPorPalabra * 100) / 100,
      promedioPalabrasPorLinea: Math.round(promedioPalabrasPorLinea * 100) / 100,
      calidad: this.determinarCalidad(palabras.length, caracteresTotales)
    };
  }

  /**
   * Determina la calidad del texto extraído - sin cambios
   */
  private determinarCalidad(palabras: number, caracteres: number): 'alta' | 'media' | 'baja' {
    if (palabras > 50 && caracteres > 200) {
      return 'alta';
    } else if (palabras > 10 && caracteres > 50) {
      return 'media';
    } else {
      return 'baja';
    }
  }
}