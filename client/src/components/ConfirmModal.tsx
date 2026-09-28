import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  requireMatchWord?: string;
  isDangerous?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  requireMatchWord,
  isDangerous = false,
}) => {
  const [typedInput, setTypedInput] = useState('');

  if (!isOpen) return null;

  const canConfirm = !requireMatchWord || typedInput.trim() === requireMatchWord;

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
      setTypedInput('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#0e1017] border border-[#232838] shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#232838] bg-[#12141d]">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`size-4 ${isDangerous ? 'text-rose-500' : 'text-amber-500'}`} />
            <h3 className="font-mono text-xs uppercase tracking-wider font-semibold text-zinc-100">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
            {description}
          </p>

          {requireMatchWord && (
            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                Type <span className="font-bold text-rose-400 select-all underline decoration-dashed">{requireMatchWord}</span> to confirm:
              </label>
              <input
                type="text"
                autoFocus
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                placeholder={requireMatchWord}
                className="w-full px-3 py-1.5 bg-[#06070a] border border-zinc-700 font-mono text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-[#08090d] border-t border-[#232838]">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-wider px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className={`font-mono text-xs uppercase tracking-wider font-semibold px-4 py-1.5 transition-all ${
              isDangerous
                ? 'bg-rose-600 hover:bg-rose-500 text-white disabled:bg-rose-950/40 disabled:text-zinc-500'
                : 'bg-white hover:bg-zinc-200 text-black disabled:bg-zinc-800 disabled:text-zinc-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
