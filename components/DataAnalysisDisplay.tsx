import React, { useRef, useState } from 'react';
import { DataAnalysisResult, CSVData, ChartParameter } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
} from 'recharts';
import { InformationCircleIcon, LightBulbIcon, ExclamationTriangleIcon, DocumentTextIcon, ChartBarIcon, TableCellsIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';

interface DataAnalysisDisplayProps {
  analysisResult: DataAnalysisResult | null;
  csvData: CSVData | null;
}

const CHART_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#3B82F6']; // Tailwind-inspired colors

const DataAnalysisDisplay: React.FC<DataAnalysisDisplayProps> = ({ analysisResult, csvData }) => {
  const chartRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [isExporting, setIsExporting] = useState(false);

  if (!analysisResult) {
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl text-center text-gray-400 border border-gray-700">
        Upload a CSV file to begin the data analysis.
      </div>
    );
  }

  const parseValue = (value: string) => {
    if (value === null || value === undefined || value.trim() === '') return NaN;
    const num = Number(value);
    return isNaN(num) ? value : num;
  };

  const prepareChartData = (chartParam: ChartParameter, data: CSVData) => {
    const rawRows = data.rows.map(row => {
      const rowObject: { [key: string]: any } = {};
      data.headers.forEach((header, i) => {
        rowObject[header] = parseValue(row[i]);
      });
      return rowObject;
    });

    switch (chartParam.type) {
      case 'bar': {
        if (chartParam.columns.length === 1) {
          // Count occurrences for a single categorical column
          const column = chartParam.columns[0];
          const counts: { [key: string]: number } = {};
          rawRows.forEach(row => {
            const value = String(row[column]);
            if (value !== 'NaN' && value !== 'undefined') { // Exclude NaNs and undefined values from counts
              counts[value] = (counts[value] || 0) + 1;
            }
          });
          return Object.entries(counts).map(([name, count]) => ({ name, count }));
        }
        // Fallback or handle multiple columns for grouped bar chart if needed (more complex)
        return [];
      }
      case 'scatter': {
        if (chartParam.columns.length === 2) {
          const [xCol, yCol] = chartParam.columns;
          return rawRows.filter(row => !isNaN(row[xCol]) && !isNaN(row[yCol])).map(row => ({
            [xCol]: row[xCol],
            [yCol]: row[yCol],
          }));
        }
        return [];
      }
      case 'line': {
        if (chartParam.columns.length >= 2) { // Typically X-axis (e.g., date) and one or more Y-axes
          const xCol = chartParam.columns[0];
          const yCols = chartParam.columns.slice(1);
          return rawRows.map(row => {
            const obj: Record<string, any> = { [xCol]: row[xCol] };
            yCols.forEach(yCol => {
              if (!isNaN(row[yCol])) {
                obj[yCol] = row[yCol];
              }
            });
            return obj;
          });
        }
        return [];
      }
      default:
        return [];
    }
  };

  const renderChart = (chartParam: ChartParameter, data: CSVData, index: number) => {
    if (!data || !chartParam.columns || chartParam.columns.length === 0) {
      return (
        <div key={`chart-container-${index}`} className="bg-gray-700 p-5 rounded-lg border border-gray-600 shadow-sm text-gray-400 text-center">
          <h3 className="text-xl font-semibold text-blue-400 mb-2">{chartParam.title}</h3>
          <p>Chart data could not be generated for this visualization due to missing data or invalid column configuration.</p>
        </div>
      );
    }

    const chartData = prepareChartData(chartParam, data);
    if (!chartData || chartData.length === 0) {
       return (
        <div key={`chart-container-${index}`} className="bg-gray-700 p-5 rounded-lg border border-gray-600 shadow-sm text-gray-400 text-center">
          <h3 className="text-xl font-semibold text-blue-400 mb-2">{chartParam.title}</h3>
          <p>No valid data found to render this chart type with the specified columns.</p>
        </div>
      );
    }

    const chartId = `chart-${index}`;
    const xKey = chartParam.columns[0] || 'name'; // Default for bar chart category
    const yKey = chartParam.columns[1] || 'count'; // Default for bar chart value

    return (
      <div key={`chart-outer-${chartId}`} ref={el => { chartRefs.current[index] = el; }} id={chartId} className="bg-gray-700 p-6 rounded-xl border border-gray-600 shadow-lg">
        <h3 className="text-xl font-semibold text-blue-400 mb-2">{chartParam.title}</h3>
        <p className="text-gray-300 text-sm mb-4 italic">{chartParam.description}</p>
        <ResponsiveContainer width="100%" height={300}>
          {chartParam.type === 'bar' && chartParam.columns.length === 1 && (
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" /> {/* Darker grid lines */}
              <XAxis dataKey="name" angle={-15} textAnchor="end" height={60} interval={0} tick={{ fill: '#D1D5DB', fontSize: 10 }} label={{ value: chartParam.xAxisLabel || chartParam.columns[0], position: 'insideBottom', offset: -5, fill: '#9CA3AF' }} />
              <YAxis tick={{ fill: '#D1D5DB' }} label={{ value: chartParam.yAxisLabel || 'Count', angle: -90, position: 'insideLeft', offset: 0, fill: '#9CA3AF' }} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.1)' }} contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '8px', color: '#D1D5DB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ color: '#D1D5DB' }} />
              <Bar dataKey="count" fill={CHART_COLORS[0]} name="Count" />
            </BarChart>
          )}
          {chartParam.type === 'scatter' && chartParam.columns.length === 2 && (
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" /> {/* Darker grid lines */}
              <XAxis type="number" dataKey={chartParam.columns[0]} name={chartParam.xAxisLabel || chartParam.columns[0]} tick={{ fill: '#D1D5DB' }} label={{ value: chartParam.xAxisLabel || chartParam.columns[0], position: 'insideBottom', offset: -5, fill: '#9CA3AF' }} />
              <YAxis type="number" dataKey={chartParam.columns[1]} name={chartParam.yAxisLabel || chartParam.columns[1]} tick={{ fill: '#D1D5DB' }} label={{ value: chartParam.yAxisLabel || chartParam.columns[1], angle: -90, position: 'insideLeft', offset: 0, fill: '#9CA3AF' }} />
              <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#9CA3AF' }} contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '8px', color: '#D1D5DB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ color: '#D1D5DB' }} />
              <Scatter name={chartParam.title} data={chartData} fill={CHART_COLORS[1]} />
            </ScatterChart>
          )}
          {chartParam.type === 'line' && chartParam.columns.length >= 2 && (
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" /> {/* Darker grid lines */}
              <XAxis dataKey={chartParam.columns[0]} angle={-15} textAnchor="end" height={60} interval={0} tick={{ fill: '#D1D5DB', fontSize: 10 }} label={{ value: chartParam.xAxisLabel || chartParam.columns[0], position: 'insideBottom', offset: -5, fill: '#9CA3AF' }} />
              <YAxis tick={{ fill: '#D1D5DB' }} label={{ value: chartParam.yAxisLabel || 'Value', angle: -90, position: 'insideLeft', offset: 0, fill: '#9CA3AF' }} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.1)' }} contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '8px', color: '#D1D5DB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ color: '#D1D5DB' }} />
              {chartParam.columns.slice(1).map((col, i) => (
                <Line
                  key={col}
                  type="monotone"
                  dataKey={col}
                  stroke={CHART_COLORS[(i + 2) % CHART_COLORS.length]} // Use different colors for lines
                  name={col}
                  activeDot={{ r: 8 }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  const renderSection = (title: string, content: React.ReactNode, Icon: React.ElementType) => (
    <div className="mb-8 bg-gray-800 rounded-xl shadow-xl border border-gray-700">
      <div className="flex items-center p-6 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 rounded-t-xl">
        <Icon className="h-7 w-7 text-blue-400 mr-3" />
        <h2 className="text-2xl font-bold text-gray-100">{title}</h2>
      </div>
      <div className="prose max-w-none p-6 text-gray-300">
        {content}
      </div>
    </div>
  );

  const exportToPdf = async () => {
    setIsExporting(true);
    const doc = new jsPDF('p', 'mm', 'a4');
    let yPos = 10;
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(22);
    doc.setTextColor('#60A5FA'); // blue-400
    doc.text('Data Analysis Report', margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setTextColor('#9CA3AF'); // gray-400
    doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, yPos);
    yPos += 15;

    // Helper to add text and manage page breaks
    const addText = (text: string, fontSize: number, textColor: string, startY: number, lineSpacing: number = 7) => {
      doc.setFontSize(fontSize);
      doc.setTextColor(textColor);
      const splitText = doc.splitTextToSize(text, pageWidth - 2 * margin);
      splitText.forEach((line: string) => {
        if (startY + lineSpacing > pageHeight - margin) {
          doc.addPage();
          startY = margin;
        }
        doc.text(line, margin, startY);
        startY += lineSpacing;
      });
      return startY;
    };

    yPos = addText('Summary', 18, '#60A5FA', yPos);
    yPos += 3;
    yPos = addText(analysisResult.summary, 12, '#D1D5DB', yPos);
    yPos += 8;

    if (analysisResult.analysisNotes && analysisResult.analysisNotes.length > 0) {
      yPos = addText('Analysis Notes', 18, '#60A5FA', yPos);
      yPos += 3;
      analysisResult.analysisNotes.forEach((note) => {
        yPos = addText(`• ${note}`, 12, '#FCD34D', yPos); // yellow-300
      });
      yPos += 8;
    }

    if (analysisResult.keyInsights.length > 0) {
      yPos = addText('Key Insights', 18, '#60A5FA', yPos);
      yPos += 3;
      analysisResult.keyInsights.forEach((insight) => {
        yPos = addText(`• ${insight}`, 12, '#D1D5DB', yPos);
      });
      yPos += 8;
    }

    if (analysisResult.dataQualityIssues.length > 0) {
      yPos = addText('Data Quality Issues', 18, '#60A5FA', yPos);
      yPos += 3;
      analysisResult.dataQualityIssues.forEach((issue) => {
        yPos = addText(`• ${issue}`, 12, '#F87171', yPos); // red-400
      });
      yPos += 8;
    }

    yPos = addText('Data Story Narrative Hook', 18, '#60A5FA', yPos);
    yPos += 3;
    yPos = addText(`"${analysisResult.narrativeHook}"`, 12, '#93C5FD', yPos); // blue-300
    yPos += 8;

    if (csvData) {
      yPos = addText('CSV Data Preview (First 5 Rows)', 18, '#60A5FA', yPos);
      yPos += 3;
      yPos = addText(`Headers: ${csvData.headers.join(', ')}`, 10, '#D1D5DB', yPos);
      csvData.rows.slice(0, 5).forEach(row => {
        yPos = addText(row.join(', '), 10, '#E5E7EB', yPos);
      });
      if (csvData.rows.length > 5) {
        yPos = addText(`...and ${csvData.rows.length - 5} more rows.`, 10, '#9CA3AF', yPos);
      }
      yPos += 8;
    }

    if (analysisResult.chartParameters.length > 0 && csvData) {
      yPos = addText('Visualizations', 18, '#60A5FA', yPos);
      yPos += 5;

      for (let i = 0; i < analysisResult.chartParameters.length; i++) {
        const chartElement = chartRefs.current[i];
        if (chartElement) {
          try {
            const imgData = await htmlToImage.toPng(chartElement, {
              quality: 0.95,
              style: {
                backgroundColor: '#374151', // Dark background for chart images in PDF
                padding: '16px' // Match padding
              }
            });

            const imgProps = doc.getImageProperties(imgData);
            const imgWidth = 180; // Fixed width for chart image in PDF
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            if (yPos + imgHeight + 10 > pageHeight - margin) { // Check if chart fits on current page
              doc.addPage();
              yPos = margin;
            }

            doc.setFontSize(14);
            doc.setTextColor('#D1D5DB'); // gray-300
            doc.text(analysisResult.chartParameters[i].title, margin, yPos);
            yPos += 5;
            doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
            yPos += imgHeight + 10; // Add some space after the image
          } catch (error) {
            console.error(`Error converting chart ${i} to image:`, error);
            yPos = addText(`Could not export chart: ${analysisResult.chartParameters[i].title}`, 12, '#EF4444', yPos);
            yPos += 5;
          }
        }
      }
    }

    doc.save('data_analysis_report.pdf');
    setIsExporting(false);
  };


  return (
    <div className="space-y-8">
      <div className="flex justify-end mb-4">
        <button
          onClick={exportToPdf}
          disabled={!analysisResult || isExporting}
          className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-200 ease-in-out
                      ${!analysisResult || isExporting
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
        >
          {isExporting ? (
            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
          )}
          {isExporting ? 'Exporting...' : 'Export as PDF'}
        </button>
      </div>

      {analysisResult.analysisNotes && analysisResult.analysisNotes.length > 0 && (
        <div className="bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-300 p-4 rounded-md shadow-sm">
          <p className="font-semibold">Analysis Notes:</p>
          <ul className="list-disc pl-5">
            {analysisResult.analysisNotes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {csvData && (
        <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700">
          <div className="flex items-center p-6 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 rounded-t-xl">
            <TableCellsIcon className="h-7 w-7 text-blue-400 mr-3" />
            <h2 className="text-2xl font-bold text-gray-100">
              CSV Data Preview
            </h2>
          </div>
          <div className="overflow-x-auto rounded-b-xl border border-gray-700 shadow-sm">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  {csvData.headers.map((header, index) => (
                    <th
                      key={index}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {csvData.rows.slice(0, 5).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {csvData.rows.length > 5 && (
            <p className="text-sm text-gray-400 mt-2 p-4">Showing first 5 rows of {csvData.rows.length}...</p>
          )}
        </div>
      )}

      {renderSection(
        'Data Summary',
        <p>{analysisResult.summary}</p>,
        InformationCircleIcon
      )}

      {analysisResult.keyInsights.length > 0 && renderSection(
        'Key Insights',
        <ul className="list-disc pl-5 space-y-2">
          {analysisResult.keyInsights.map((insight, index) => (
            <li key={index}>{insight}</li>
          ))}
        </ul>,
        LightBulbIcon
      )}

      {analysisResult.dataQualityIssues.length > 0 && renderSection(
        'Data Quality Issues',
        <ul className="list-disc pl-5 space-y-2 text-red-300">
          {analysisResult.dataQualityIssues.map((issue, index) => (
            <li key={index}>{issue}</li>
          ))}
        </ul>,
        ExclamationTriangleIcon
      )}

      {renderSection(
        'Data Story Narrative Hook',
        <p className="italic text-lg text-blue-300 bg-blue-900/30 p-4 rounded-md border-l-4 border-blue-500">
          "{analysisResult.narrativeHook}"
        </p>,
        DocumentTextIcon
      )}

      {analysisResult.chartParameters.length > 0 && csvData && (
        <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700">
          <div className="flex items-center p-6 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 rounded-t-xl">
            <ChartBarIcon className="h-7 w-7 text-blue-400 mr-3" />
            <h2 className="text-2xl font-bold text-gray-100">
              Visualizations
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 p-6">
            {analysisResult.chartParameters.map((param, index) =>
              renderChart(param, csvData, index)
            )}
          </div>
        </div>
      )}
      {!analysisResult.chartParameters.length && csvData && (
        <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700">
          <div className="flex items-center p-6 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 rounded-t-xl">
            <ChartBarIcon className="h-7 w-7 text-blue-400 mr-3" />
            <h2 className="text-2xl font-bold text-gray-100">
              Visualizations
            </h2>
          </div>
          <div className="p-6 text-center text-gray-400">
            <p>No visualizations were suggested or could be generated for this dataset.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataAnalysisDisplay;