import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './ChartCard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface DocumentosPorDiaChartProps {
  labels: string[]; // Ej: ['Lun', 'Mar', ...]
  data: number[];  // Ej: [5, 8, 3, ...]
}

const DocumentosPorDiaChart: React.FC<DocumentosPorDiaChartProps> = ({ labels, data }) => {
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Documentos procesados',
        data,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Documentos procesados por día (últimos 7 días)',
      },
    },
  };

  return (
    <div className="chart-card">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default DocumentosPorDiaChart; 