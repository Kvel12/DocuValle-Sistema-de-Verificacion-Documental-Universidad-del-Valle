import React from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface DistribucionDocumentosChartProps {
  aceptados: number;
  enRevision: number;
  rechazados: number;
}

const DistribucionDocumentosChart: React.FC<DistribucionDocumentosChartProps> = ({ aceptados, enRevision, rechazados }) => {
  const data = {
    labels: ['Aceptados', 'En revisión', 'Rechazados'],
    datasets: [
      {
        data: [aceptados, enRevision, rechazados],
        backgroundColor: [
          'rgba(75, 192, 192, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(255, 99, 132, 0.7)',
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      title: {
        display: true,
        text: 'Distribución de documentos',
      },
    },
  };

  return <Pie data={data} options={options} />;
};

export default DistribucionDocumentosChart; 