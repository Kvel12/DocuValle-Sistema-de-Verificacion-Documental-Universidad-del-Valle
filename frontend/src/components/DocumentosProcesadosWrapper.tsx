import React from 'react';
import DocumentosProcesados from './DocumentosProcesados';

interface DocumentosProcesadosWrapperProps {
  apiBaseUrl: string;
  mostrarBotonAbrir: boolean;
  titulo: string;
  onCerrar?: () => void;
}

const DocumentosProcesadosWrapper: React.FC<DocumentosProcesadosWrapperProps> = ({
  apiBaseUrl,
  mostrarBotonAbrir,
  titulo,
  onCerrar
}) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '2rem',
        width: '90%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Botón cerrar */}
        {onCerrar && (
          <button
            onClick={onCerrar}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '50%',
              color: '#666',
              transition: 'all 0.3s ease',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f5f5f5';
              e.currentTarget.style.color = '#333';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#666';
            }}
          >
            ✕
          </button>
        )}

        {/* Componente de documentos procesados */}
        <DocumentosProcesados 
          apiBaseUrl={apiBaseUrl}
          mostrarBotonAbrir={mostrarBotonAbrir}
          titulo={titulo}
        />
      </div>
    </div>
  );
};

export default DocumentosProcesadosWrapper;