// Servicio especializado en Vision API de Google Cloud
// Este servicio se encarga exclusivamente de extraer texto de imágenes y documentos

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
   * Extrae texto de un archivo usando Vision API
   * Es como tener un asistente que puede "leer" cualquier imagen o PDF
   * 
   * @param buffer - Los datos del archivo en memoria
   * @param mimeType - El tipo de archivo (image/jpeg, application/pdf, etc.)
   * @returns Promise<string> - El texto extraído del documento
   */
  async detectTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      console.log(`🔍 Analizando archivo de tipo: ${mimeType}, tamaño: ${buffer.length} bytes`);

      // Configuramos la petición a Vision API
      // Es como enviar el documento a un experto en lectura de textos
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

      // Enviamos la petición a Vision API
      const [result] = await this.visionClient.annotateImage(request);

      // Verificamos si hubo errores en el procesamiento
      if (result.error) {
        throw new Error(`Vision API error: ${result.error.message}`);
      }

      // Extraemos el texto detectado
      // Preferimos DOCUMENT_TEXT_DETECTION porque es más preciso para documentos formales
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
        } else {
          throw new Error(`Error procesando el documento: ${error.message}`);
        }
      }
      
      throw new Error('Error desconocido al procesar el documento con Vision API');
    }
  }

  /**
   * Limpia y mejora el texto extraído por Vision API
   * Es como tener un editor que mejora la legibilidad del texto
   * 
   * @param textoRaw - Texto sin procesar de Vision API
   * @returns string - Texto limpio y formateado
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
   * Analiza la calidad del texto extraído
   * Útil para determinar si el documento fue procesado correctamente
   * 
   * @param texto - Texto extraído para analizar
   * @returns objeto con métricas de calidad
   */
  analizarCalidadTexto(texto: string) {
    const palabras = texto.split(/\s+/).filter(palabra => palabra.length > 0);
    const caracteresTotales = texto.length;
    const lineas = texto.split('\n').filter(linea => linea.trim().length > 0);
    
    // Calculamos métricas básicas
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
   * Determina la calidad del texto extraído basado en métricas simples
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