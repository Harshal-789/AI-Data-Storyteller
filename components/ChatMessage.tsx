import React from 'react';
import { Message } from '../types';
import { SpeakerWaveIcon } from '@heroicons/react/20/solid';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const messageClass = isUser
    ? 'bg-indigo-600 text-white self-end rounded-br-none'
    : 'bg-gray-700 text-gray-100 self-start rounded-bl-none'; // AI message bubble background and text color

  return (
    <div className={`flex flex-col max-w-[80%] p-3 rounded-xl shadow-md mb-4 transition-all duration-200 ${messageClass}`}>
      <div className="flex items-center text-xs font-semibold mb-1 space-x-2">
        {isUser ? (
          <span className="text-blue-200">🧑‍💻 You</span>
        ) : (
          <span className="text-indigo-300">✨ AI Data Scientist</span>
        )}
        <span className="text-gray-400 text-[0.65rem]">{message.timestamp}</span>
        {!isUser && message.audioAvailable && (
          <SpeakerWaveIcon
            className={`h-4 w-4 ${message.isPlaying ? 'text-blue-400 animate-pulse' : 'text-gray-400'} transition-colors duration-200`}
            title={message.isPlaying ? 'Speaking...' : 'Click to hear'}
          />
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap">{message.text}</p>
    </div>
  );
};

export default ChatMessage;