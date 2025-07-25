import React from 'react';
import './MetricasBasicasDashboard.css';

interface MetricasBasicasDashboardProps {
  total: number;
  hoy: number;
  scorePromedio: number;
}

const MetricasBasicasDashboard: React.FC<MetricasBasicasDashboardProps> = ({ total, hoy, scorePromedio }) => {
  return (
    <div className="metricas-dashboard">
      <div className="metrica-card">
        <h4>Total procesados</h4>
        <p>{total}</p>
      </div>
      <div className="metrica-card">
        <h4>Procesados hoy</h4>
        <p>{hoy}</p>
      </div>
      <div className="metrica-card">
        <h4>Score promedio</h4>
        <p>{scorePromedio.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default MetricasBasicasDashboard; 