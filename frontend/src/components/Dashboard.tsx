import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  DocumentosPorDiaChart,
  DistribucionDocumentosChart,
  MetricasBasicasDashboard,
  UltimosDocumentosList,
} from './charts';
import { DocumentoProcesado } from './charts/UltimosDocumentosList';
import DocumentosProcesados from './DocumentosProcesados';
import { API_BASE_URL } from '../src/config/firebase';

interface StatsResponse {
  totalDocumentos: number;
  documentosHoy: number;
  scorePromedio: number;
  distribucionRecomendaciones: { [key: string]: number };
  tendenciaUltimos30Dias: Array<{ fecha: string; cantidad: number }>;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [ultimosDocumentos, setUltimosDocumentos] = useState<DocumentoProcesado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/dashboard/stats`);
        if (res.data.success) {
          setStats(res.data.stats);
        } else {
          setError('No se pudieron obtener las estadísticas');
        }
      } catch (err) {
        setError('Error al obtener estadísticas del dashboard');
      } finally {
        setLoading(false);
      }
    };

  // Preparar datos para los componentes

    const fetchUltimos = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/dashboard/ultimos`);
        if (res.data.success) {
          setUltimosDocumentos(res.data.documentos);
        }
      } catch (err) {
        console.log('Error obteniendo últimos documentos:', err);
      }
    };

    fetchStats();
    fetchUltimos();
  }, []);

 
  const labels = stats?.tendenciaUltimos30Dias?.slice(-7).map(d => d.fecha) || [];
  const data = stats?.tendenciaUltimos30Dias?.slice(-7).map(d => d.cantidad) || [];
  const distribucion = {
    aceptados: stats?.distribucionRecomendaciones['accept'] || 0,
    enRevision: stats?.distribucionRecomendaciones['review'] || 0,
    rechazados: stats?.distribucionRecomendaciones['reject'] || 0,
  };
  const metricas = {
    total: stats?.totalDocumentos || 0,
    hoy: stats?.documentosHoy || 0,
    scorePromedio: stats?.scorePromedio || 0,
  };

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>
        
        {/* Sección de bienvenida y acciones principales */}
        <div className="welcome-section" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '20px',
          padding: '2rem',
          marginBottom: '2rem',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ 
            margin: '0 0 0.5rem 0', 
            fontSize: '2.2rem', 
            fontWeight: '700' 
          }}>
            ¡Bienvenido a DocuValle! 📄
          </h1>
          <p style={{ 
            margin: '0 0 2rem 0', 
            fontSize: '1.1rem', 
            opacity: 0.9 
          }}>
            Sistema inteligente de análisis y verificación de documentos
          </p>

          {/* Botón de acción principal - CENTRADO */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center' 
          }}>
            <button
              onClick={() => navigate('/upload')}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                borderRadius: '15px',
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                minWidth: '200px',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>📤</span>
              Analizar Documento
            </button>
          </div>
        </div>

        {/* Título del dashboard */}
        <h2 style={{ 
          color: '#333', 
          marginBottom: '2rem',
          fontSize: '1.8rem',
          fontWeight: '600'
        }}>
          📊 Dashboard Analítico
        </h2>

        {/* Contenido del dashboard */}
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
          }}>
            <div style={{ 
              fontSize: '2rem', 
              marginBottom: '1rem' 
            }}>⏳</div>
            <p style={{ 
              color: '#666', 
              fontSize: '1.1rem' 
            }}>Cargando estadísticas...</p>
          </div>
        ) : error ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
            borderRadius: '16px',
            color: 'white'
          }}>
            <div style={{ 
              fontSize: '2rem', 
              marginBottom: '1rem' 
            }}>❌</div>
            <p style={{ 
              fontSize: '1.1rem',
              fontWeight: '500'
            }}>{error}</p>
          </div>
        ) : stats ? (
          <>
            {/* Métricas básicas */}
            <MetricasBasicasDashboard {...metricas} />
            
            {/* Gráficos */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: '2rem', 
              marginBottom: '2rem' 
            }}>
              <div style={{ 
                background: 'white',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
              }}>
                <DocumentosPorDiaChart labels={labels} data={data} />
              </div>
              <div style={{ 
                background: 'white',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
              }}>
                <DistribucionDocumentosChart {...distribucion} />
              </div>
            </div>
            
            {/* Últimos documentos */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}>
              <UltimosDocumentosList documentos={ultimosDocumentos} />
            </div>
          </>
        ) : null}
        
      </div>
      
      {/* Componente de Documentos Procesados - Con padding inferior */}
      <div style={{ paddingBottom: '3rem' }}>
        <DocumentosProcesados 
          apiBaseUrl={API_BASE_URL}
          mostrarBotonAbrir={true} // El componente maneja su propio botón y lógica
          titulo="📚 Documentos Procesados"
        />
      </div>
    </>
  );
};

export default Dashboard;