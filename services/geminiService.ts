import { GoogleGenAI, Chat, GenerateContentResponse, Type, Modality } from "@google/genai";
import { DataAnalysisResult, CSVData } from "../types";

// Helper function to encode Uint8Array to base64 string
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function to decode base64 string to Uint8Array
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper function to decode raw PCM audio data into an AudioBuffer
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


const getGenAI = () => {
  // Always create a new GoogleGenAI instance to ensure the latest API key is used,
  // especially for Veo models which require explicit API key selection.
  // Although not directly used by this service's models (which use general GenAI),
  // it's a good practice to follow the guideline for consistency across the app.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeCsvData = async (
  csvData: CSVData,
): Promise<{ analysisResult: DataAnalysisResult | null; truncationNote: string | null }> => {
  const ai = getGenAI();
  let truncationNote: string | null = null;

  // Combine headers and a sample of rows for the prompt
  const maxRowsForPrompt = 100; // Limit the number of rows sent to the model
  const csvContent = [
    csvData.headers.join(','),
    ...csvData.rows.slice(0, maxRowsForPrompt).map((row) => row.join(',')),
  ].join('\n');

  if (csvData.rows.length > maxRowsForPrompt) {
    truncationNote = `Only the first ${maxRowsForPrompt} rows of your CSV were sent to the AI for analysis due to prompt length limitations. The full dataset was used for chart generation.`;
  }

  const prompt = `You are an expert data analyst. Analyze the following CSV data and provide a structured JSON response.
  
  CSV Data:\n${csvContent}\n
  
  Please provide:
  1. A high-level 'summary' of the dataset (around 2-3 sentences).
  2. An array of 'keyInsights' (3-5 concise, interesting findings).
  3. An array of 'dataQualityIssues' (e.g., missing values, inconsistencies, potential outliers; 0-3 issues).
  4. A 'narrativeHook' (an engaging start or idea for a data story, 1-2 sentences).
  5. An array of 'chartParameters', each specifying:
     - 'type': 'bar', 'line', or 'scatter' (choose based on data suitability).
     - 'title': A descriptive title for the chart.
     - 'description': What the plot would show and why it's relevant.
     - 'xAxisLabel' (optional): Label for the x-axis.
     - 'yAxisLabel' (optional): Label for the y-axis.
     - 'columns': An array of column names from the CSV data to be used in the chart. For 'bar' charts with a single column, it implies a count of unique values. For 'scatter' or 'line' charts, the first column is typically X and subsequent are Y. Ensure the columns selected are appropriate for the chart type (e.g., numerical for scatter/line axes).
  
  Return the response in JSON format according to the following schema. Ensure all fields are present, even if empty arrays for lists.
  
  Schema for chartParameters:
  interface ChartParameter {
    type: 'bar' | 'line' | 'scatter';
    title: string;
    description: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    columns: string[];
  }
  
  Schema for DataAnalysisResult:
  interface DataAnalysisResult {
    summary: string;
    keyInsights: string[];
    dataQualityIssues: string[];
    narrativeHook: string;
    chartParameters: ChartParameter[];
    analysisNotes?: string[]; // Use this to pass truncation notes if any
  }
  
  Make sure your JSON is valid and complete.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Using flash for its speed in text processing
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyInsights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            dataQualityIssues: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            narrativeHook: { type: Type.STRING },
            chartParameters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['bar', 'line', 'scatter'] },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  xAxisLabel: { type: Type.STRING },
                  yAxisLabel: { type: Type.STRING },
                  columns: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['type', 'title', 'description', 'columns'],
              },
            },
            analysisNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['summary', 'keyInsights', 'dataQualityIssues', 'narrativeHook', 'chartParameters'],
        },
      },
    });

    let jsonStr = response.text.trim();
    // Some models might prepend '```json' and append '```'
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.substring(7);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.substring(0, jsonStr.length - 3);
    }

    const result: DataAnalysisResult = JSON.parse(jsonStr);

    if (truncationNote) {
      if (!result.analysisNotes) {
        result.analysisNotes = [];
      }
      result.analysisNotes.unshift(truncationNote); // Add truncation note to the beginning
    }

    return { analysisResult: result, truncationNote: truncationNote };
  } catch (error) {
    console.error("Error analyzing CSV data:", error);
    throw new Error(`Failed to analyze CSV data: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const createChatSession = (initialContext: string): Chat => {
  const ai = getGenAI();
  return ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: `You are an AI data scientist assisting a user with insights about their uploaded CSV data.
      You have already provided an initial analysis. Now, respond to follow-up questions about the data.
      Keep responses concise and helpful. Remember the context of the initial data analysis: ${initialContext}`,
    },
  });
};

export const sendMessageToChat = async (
  chat: Chat,
  message: string,
): Promise<GenerateContentResponse> => {
  try {
    const responseStream = await chat.sendMessageStream({ message: message });
    let fullText = '';
    const collectedChunks: GenerateContentResponse[] = [];
    for await (const chunk of responseStream) {
      collectedChunks.push(chunk);
      if (chunk.text) {
        fullText += chunk.text;
      }
    }
    // Return a single GenerateContentResponse with the aggregated text
    return {
      text: fullText,
      candidates: collectedChunks[0]?.candidates, // Use candidates from the first chunk for metadata if needed
      usage: collectedChunks.reduce((acc, chunk) => ({
        inputTokens: acc.inputTokens + (chunk.usage?.inputTokens || 0),
        outputTokens: acc.outputTokens + (chunk.usage?.outputTokens || 0),
      }), { inputTokens: 0, outputTokens: 0 }),
    };
  } catch (error) {
    console.error("Error sending message to chat:", error);
    throw new Error(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const generateSpeech = async (text: string): Promise<string> => {
  const ai = getGenAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Choose a voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data received from TTS API.");
    }
    return base64Audio;
  } catch (error) {
    console.error("Error generating speech:", error);
    throw new Error(`Failed to generate speech: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export { decode, decodeAudioData }; // Export these for use in App.tsx
