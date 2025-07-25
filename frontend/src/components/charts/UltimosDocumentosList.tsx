import React from 'react';
import './ChartCard.css';

export interface DocumentoProcesado {
  id: string;
  nombre: string;
  fecha: string; // ISO o formato legible
  estado: 'aceptado' | 'en_revision' | 'rechazado';
}

interface UltimosDocumentosListProps {
  documentos: DocumentoProcesado[];
}

const estadoLabel: Record<string, string> = {
  aceptado: 'Aceptado',
  en_revision: 'En revisión',
  rechazado: 'Rechazado',
};

const estadoColor: Record<string, string> = {
  aceptado: '#4caf50',
  en_revision: '#ffb300',
  rechazado: '#f44336',
};

const UltimosDocumentosList: React.FC<UltimosDocumentosListProps> = ({ documentos }) => {
  return (
    <div className="chart-card">
      <h4>Últimos 5 documentos procesados</h4>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {documentos.map((doc) => (
          <li key={doc.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.5rem 0',
            borderBottom: '1px solid #eee',
          }}>
            <span>{doc.nombre}</span>
            <span style={{ color: '#888' }}>{doc.fecha}</span>
            <span style={{ color: estadoColor[doc.estado], fontWeight: 600 }}>{estadoLabel[doc.estado]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UltimosDocumentosList; 