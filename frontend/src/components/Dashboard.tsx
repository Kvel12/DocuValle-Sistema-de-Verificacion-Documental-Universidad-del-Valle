import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  DocumentosPorDiaChart,
  DistribucionDocumentosChart,
  MetricasBasicasDashboard,
  UltimosDocumentosList,
} from './charts';
import { DocumentoProcesado } from './charts/UltimosDocumentosList';
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
    const fetchUltimos = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/dashboard/ultimos`);
        if (res.data.success) {
          setUltimosDocumentos(res.data.documentos);
        }
      } catch (err) {
        /* No es crítico, solo log */
      }
    };
    fetchStats();
    fetchUltimos();
  }, []);

  // Preparar datos para los componentes
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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <h2>Dashboard Principal</h2>
      {loading ? (
        <p>Cargando estadísticas...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : stats ? (
        <>
          <MetricasBasicasDashboard {...metricas} />
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <div style={{ flex: 2, minWidth: 320 }}>
              <DocumentosPorDiaChart labels={labels} data={data} />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <DistribucionDocumentosChart {...distribucion} />
            </div>
          </div>
          {/* Aquí se puede agregar la lista de últimos documentos cuando haya endpoint */}
          <UltimosDocumentosList documentos={ultimosDocumentos} />
        </>
      ) : null}
    </div>
  );
};

export default Dashboard; 