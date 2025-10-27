export interface ChartParameter {
  type: 'bar' | 'line' | 'scatter'; // e.g., "bar", "line", "scatter"
  title: string;
  description: string; // Describes what the plot would show and why it's relevant.
  xAxisLabel?: string;
  yAxisLabel?: string;
  columns: string[]; // Which columns are involved from the CSVData
}

export interface DataAnalysisResult {
  summary: string; // High-level summary of the dataset
  keyInsights: string[]; // Array of concise, interesting findings
  dataQualityIssues: string[]; // e.g., missing values, inconsistencies
  narrativeHook: string; // An engaging start or idea for a data story
  chartParameters: ChartParameter[]; // Parameters for client-side chart generation
  analysisNotes?: string[]; // Existing for truncation info
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  audioAvailable?: boolean; // New: indicates if audio is available for playback
  isPlaying?: boolean; // New: indicates if audio is currently playing
}

export interface CSVData {
  headers: string[];
  rows: string[][];
}