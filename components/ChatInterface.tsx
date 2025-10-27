import React, { useEffect, useRef } from 'react';
import { Message } from '../types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

interface ChatInterfaceProps {
  chatMessages: Message[];
  onSendMessage: (message: string) => void;
  isDisabled: boolean;
  isSending: boolean;
  onPlayAudio: (messageId: string, text: string) => void;
  playingMessageId: string | null;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatMessages,
  onSendMessage,
  isDisabled,
  isSending,
  onPlayAudio,
  playingMessageId,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl shadow-xl border border-gray-700">
      <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 rounded-t-xl">
        <h2 className="text-xl font-bold text-gray-100">AI Data Chat</h2>
        <p className="text-sm text-gray-400">Ask follow-up questions about your data.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {chatMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-lg italic">
            Your chat history will appear here.
          </div>
        ) : (
          chatMessages.map((message) => (
            <div key={message.id} className="flex flex-col">
              <ChatMessage
                message={{
                  ...message,
                  isPlaying: playingMessageId === message.id,
                  audioAvailable: message.sender === 'ai' ? true : false, // Only AI messages have audio option
                }}
              />
              {!message.isPlaying && message.audioAvailable && message.sender === 'ai' && (
                <button
                  onClick={() => onPlayAudio(message.id, message.text)}
                  className="ml-auto mr-auto -mt-2 mb-2 px-3 py-1 text-xs text-blue-300 bg-blue-900/30 rounded-full hover:bg-blue-800/50 transition-colors duration-200"
                >
                  Listen to AI response
                </button>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={onSendMessage} isDisabled={isDisabled} isSending={isSending} />
    </div>
  );
};

export default ChatInterface;
