import React, { useState, useCallback, KeyboardEvent } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/20/solid'; // For the send icon

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isDisabled: boolean;
  isSending: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isDisabled, isSending }) => {
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (inputValue.trim() && !isDisabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  }, [inputValue, onSendMessage, isDisabled]);

  const handleKeyPress = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent new line on Enter
      handleSendMessage();
    }
  }, [handleSendMessage]);

  return (
    <div className="flex items-center mt-4 p-4 bg-gray-800 border-t border-gray-700 rounded-b-xl">
      <textarea
        className="flex-grow p-3 border border-indigo-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none text-sm
                   bg-indigo-700 text-white placeholder-indigo-300 transition-all duration-200 ease-in-out
                   disabled:bg-gray-800 disabled:text-gray-500 disabled:placeholder-gray-600 disabled:border-gray-700 disabled:cursor-not-allowed"
        placeholder={isDisabled ? "Analyze data first to enable chat..." : "Ask a follow-up question about your data..."}
        rows={1}
        value={inputValue}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        disabled={isDisabled || isSending}
        style={{ minHeight: '42px', maxHeight: '120px' }} // Adjust height dynamically if needed, or keep fixed
      />
      <button
        onClick={handleSendMessage}
        disabled={isDisabled || isSending || !inputValue.trim()}
        className={`ml-3 px-5 py-2 rounded-lg font-medium text-white transition-all duration-200 ease-in-out flex items-center justify-center
                    ${isDisabled || isSending || !inputValue.trim()
                      ? 'bg-indigo-800 cursor-not-allowed text-gray-400'
                      : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
                    }`}
      >
        {isSending ? (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <PaperAirplaneIcon className="h-5 w-5 rotate-90" />
        )}
      </button>
    </div>
  );
};

export default ChatInput;