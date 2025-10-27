import React, { useState, useCallback, useRef } from 'react';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'; // Outline version for the icon

interface FileUploadAreaProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

const FileUploadArea: React.FC<FileUploadAreaProps> = ({ onFileSelect, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      onFileSelect(event.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileSelect(event.target.files[0]);
    }
  }, [onFileSelect]);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
      className={`
        relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer
        transition-all duration-300 ease-in-out bg-gray-800 shadow-xl
        ${isDragOver ? 'border-blue-500 bg-gray-700' : 'border-gray-700 hover:border-gray-600'}
        ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
        disabled={isLoading}
      />
      {isLoading ? (
        <div className="flex items-center text-blue-400">
          <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-lg font-medium">Analyzing data...</span>
        </div>
      ) : (
        <>
          <CloudArrowUpIcon
            className={`w-12 h-12 mb-3 ${isDragOver ? 'text-blue-400' : 'text-gray-400'}`}
          />
          <p className={`mb-2 text-lg ${isDragOver ? 'text-blue-300' : 'text-gray-300'} font-semibold`}>
            Drag & Drop your CSV file here
          </p>
          <p className="text-sm text-gray-400">
            or <span className="font-medium text-blue-500 hover:underline">browse to upload</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">(Max file size: 20MB)</p>
        </>
      )}
    </div>
  );
};

export default FileUploadArea;