import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CSVData, DataAnalysisResult, Message } from './types';
import FileUploadArea from './components/FileUploadArea';
import DataAnalysisDisplay from './components/DataAnalysisDisplay';
import ChatInterface from './components/ChatInterface';
import { analyzeCsvData, createChatSession, sendMessageToChat, generateSpeech, decode, decodeAudioData } from './services/geminiService';
import { Chat, GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid'; // For unique message IDs

const App: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DataAnalysisResult | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentChatSession = useRef<Chat | null>(null);
  const outputAudioContext = useRef<AudioContext | null>(null);
  const currentAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  const initAudioContext = () => {
    if (!outputAudioContext.current) {
      outputAudioContext.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
  };

  const stopCurrentAudio = useCallback(() => {
    if (currentAudioSource.current) {
      currentAudioSource.current.stop();
      currentAudioSource.current.disconnect();
      currentAudioSource.current = null;
    }
    setPlayingMessageId(null);
  }, []);

  useEffect(() => {
    // Cleanup audio context on unmount
    return () => {
      stopCurrentAudio();
      if (outputAudioContext.current) {
        outputAudioContext.current.close();
      }
    };
  }, [stopCurrentAudio]);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setAnalysisResult(null); // Clear previous analysis
    setChatMessages([]); // Clear chat messages

    if (file.size > 20 * 1024 * 1024) { // 20 MB limit
      setError('File size exceeds 20MB limit.');
      setSelectedFile(null);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) {
          setError('CSV file is empty.');
          setSelectedFile(null);
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => line.split(',').map(c => c.trim()));

        setCsvData({ headers, rows });
        await analyzeAndChat({ headers, rows });
      };
      reader.readAsText(file);
    } catch (err) {
      console.error("Error reading file:", err);
      setError(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const analyzeAndChat = useCallback(async (data: CSVData) => {
    setIsLoadingAnalysis(true);
    setError(null);
    try {
      // Create a new GoogleGenAI instance right before making an API call
      // to ensure it always uses the most up-to-date API key from the dialog,
      // as per Veo video API guidelines (applied generally for robustness).
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const { analysisResult: newAnalysisResult, truncationNote } = await analyzeCsvData(data);
      setAnalysisResult(newAnalysisResult);

      if (newAnalysisResult) {
        const initialContext = `The CSV data you analyzed has the following summary: "${newAnalysisResult.summary}". Key insights: ${newAnalysisResult.keyInsights.join(', ')}. Data quality issues: ${newAnalysisResult.dataQualityIssues.join(', ')}.`;
        currentChatSession.current = createChatSession(initialContext);
      }
      setChatMessages([]); // Clear previous chat history for new analysis
    } catch (err) {
      console.error("Error during analysis:", err);
      setError(`Failed to perform data analysis: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!currentChatSession.current || !analysisResult) {
      setError('Please upload and analyze data first.');
      return;
    }

    setIsSendingChat(true);
    setError(null);
    const newUserMessage: Message = {
      id: uuidv4(),
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString(),
    };
    setChatMessages((prev) => [...prev, newUserMessage]);

    try {
      const response = await sendMessageToChat(currentChatSession.current, text);
      const aiResponseText = response.text || "I'm sorry, I couldn't generate a response.";

      const newAiMessage: Message = {
        id: uuidv4(),
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString(),
        audioAvailable: true,
      };
      setChatMessages((prev) => [...prev, newAiMessage]);
    } catch (err) {
      console.error("Error sending message:", err);
      setError(`Failed to send message: ${err instanceof Error ? err.message : String(err)}`);
      // Optionally remove user message if AI response failed entirely
      setChatMessages((prev) => prev.filter((msg) => msg.id !== newUserMessage.id));
    } finally {
      setIsSendingChat(false);
    }
  }, [analysisResult]);

  const handlePlayAudio = useCallback(async (messageId: string, text: string) => {
    stopCurrentAudio(); // Stop any currently playing audio

    initAudioContext();
    const audioContext = outputAudioContext.current!;

    setPlayingMessageId(messageId);
    setChatMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, isPlaying: true } : msg));

    try {
      const base64Audio = await generateSpeech(text);
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContext,
        24000, // Sample rate as defined in geminiService
        1,     // Number of channels
      );

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination); // Connect directly to destination
      source.onended = () => {
        setPlayingMessageId(null);
        setChatMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, isPlaying: false } : msg));
        currentAudioSource.current = null;
      };
      source.start();
      currentAudioSource.current = source;
    } catch (err) {
      console.error("Error playing audio:", err);
      setError(`Failed to play audio: ${err instanceof Error ? err.message : String(err)}`);
      setPlayingMessageId(null);
      setChatMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, isPlaying: false } : msg));
    }
  }, [stopCurrentAudio]);


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8 flex flex-col items-center">
      <div className="max-w-6xl w-full space-y-8">
        <header className="text-center mb-10">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 mb-4">
            AI Data Storyteller
          </h1>
          <p className="text-xl text-gray-300">
            Upload your CSV, get instant insights, visualizations, and chat with an AI data scientist.
          </p>
        </header>

        {error && (
          <div className="bg-red-900/50 border-l-4 border-red-500 text-red-300 p-4 rounded-md shadow-sm mb-6 max-w-2xl mx-auto">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        <FileUploadArea onFileSelect={handleFileSelect} isLoading={isLoadingAnalysis} />

        {analysisResult && csvData && (
          <DataAnalysisDisplay analysisResult={analysisResult} csvData={csvData} />
        )}

        <div className="mt-10 mb-20"> {/* Margin to ensure chat input doesn't hide behind footer or other content */}
          <ChatInterface
            chatMessages={chatMessages}
            onSendMessage={handleSendMessage}
            isDisabled={!analysisResult}
            isSending={isSendingChat}
            onPlayAudio={handlePlayAudio}
            playingMessageId={playingMessageId}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
