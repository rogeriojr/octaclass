import React, { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  predefinedMessages: string[];
  title: string;
}

export const AlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, onSend, predefinedMessages, title }) => {
  const [customMessage, setCustomMessage] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-indigo-600 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3 text-white">
            <MessageSquare size={24} />
            <h2 className="text-xl font-bold">{title}</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Mensagens Rápidas</h3>
            <div className="grid grid-cols-1 gap-2">
              {predefinedMessages.map((msg, index) => (
                <button
                  key={index}
                  onClick={() => onSend(msg)}
                  className="text-left px-4 py-3 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl font-medium transition-all group border border-gray-100"
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Mensagem Personalizada</h3>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Digite sua mensagem aqui..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
            />
            <button
              onClick={() => customMessage && onSend(customMessage)}
              disabled={!customMessage}
              className="mt-4 w-full bg-indigo-600 disabled:opacity-50 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
            >
              <Send size={18} /> Enviar Mensagem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
