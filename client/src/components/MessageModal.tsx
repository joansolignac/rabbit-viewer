import React, { useEffect, useState } from 'react';
import type { QueueMessage } from '../types/rabbitmq';
import { JsonViewer } from './JsonViewer';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
  Download,
  Trash2,
  Tag,
  Hash,
  Send,
  CornerDownRight,
  Layers,
} from 'lucide-react';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: QueueMessage | null;
  index: number | null;
  totalMessages: number;
  onPrev: () => void;
  onNext: () => void;
  onAckHead?: () => void;
  accentColor?: string;
}

export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  onClose,
  message,
  index,
  totalMessages,
  onPrev,
  onNext,
  onAckHead,
  accentColor = '#ffffff',
}) => {
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Keyboard navigation: Escape to close, ArrowLeft / ArrowRight to step
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onPrev();
      } else if (e.key === 'ArrowRight') {
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onPrev, onNext, onClose]);

  if (!isOpen || !message || index === null) return null;

  const isHead = index === 0;
  const isTail = index === totalMessages - 1;
  const hasHeaders = message.properties.headers && Object.keys(message.properties.headers).length > 0;

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(
      typeof message.payload === 'object'
        ? JSON.stringify(message.payload, null, 2)
        : message.payload
    );
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleCopyCorrelationId = () => {
    if (message.properties.correlation_id) {
      navigator.clipboard.writeText(message.properties.correlation_id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleDownloadJson = () => {
    const content =
      typeof message.payload === 'object'
        ? JSON.stringify(message.payload, null, 2)
        : message.payload;
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `msg-${index + 1}-${message.routing_key || 'payload'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
      <div className="w-full max-w-4xl bg-[#090b10] border border-[#232838] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden relative">
        {/* Top Accent Line */}
        <div className="h-1 w-full" style={{ backgroundColor: accentColor }}></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#232838] bg-[#0d1017]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="font-mono text-xs uppercase tracking-wider font-extrabold px-2.5 py-1 text-black"
              style={{ backgroundColor: accentColor }}
            >
              {isHead ? '#1 HEAD OF QUEUE' : isTail ? `#${index + 1} TAIL OF QUEUE` : `#${index + 1} IN QUEUE`}
            </span>

            {isHead && (
              <span className="hw-tag border-zinc-500 text-zinc-200 bg-zinc-800/80 font-bold">
                NEXT TO CONSUME
              </span>
            )}

            {message.redelivered && (
              <span className="hw-tag border-rose-500/80 bg-rose-950/70 text-rose-300 font-bold flex items-center gap-1">
                <AlertTriangle className="size-3 text-rose-400" /> REDELIVERED
              </span>
            )}

            <span className="font-mono text-[11px] text-zinc-400">
              {message.payload_bytes} bytes
            </span>
          </div>

          {/* Stepper + Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 font-mono text-xs">
              <button
                type="button"
                onClick={onPrev}
                className="hw-btn-secondary !px-2.5 !py-1 !text-[11px]"
                title="Previous Message (←)"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="text-[11px] text-zinc-400 font-bold px-2">
                {index + 1} / {totalMessages}
              </span>
              <button
                type="button"
                onClick={onNext}
                className="hw-btn-secondary !px-2.5 !py-1 !text-[11px]"
                title="Next Message (→)"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-2"
              title="Close modal (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Metadata Grid (Hermes Architecture Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 font-mono text-xs">
            {/* Routing Key */}
            <div className="p-3 bg-[#06070a] border border-[#232838] flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                <Send className="size-3" />
                <span>Routing Key</span>
              </div>
              <span className="text-zinc-200 font-semibold select-all break-all">
                {message.routing_key || '<empty>'}
              </span>
            </div>

            {/* Exchange */}
            <div className="p-3 bg-[#06070a] border border-[#232838] flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                <Layers className="size-3" />
                <span>Exchange</span>
              </div>
              <span className="text-zinc-300 font-mono select-all break-all">
                {message.exchange || '(default / direct)'}
              </span>
            </div>

            {/* Delivery Mode & Size */}
            <div className="p-3 bg-[#06070a] border border-[#232838] flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                <Hash className="size-3" />
                <span>Delivery Mode</span>
              </div>
              <span className="text-zinc-300 font-mono">
                {message.properties.delivery_mode === 2 ? '2 (Persistent)' : '1 (Transient)'}
              </span>
            </div>

            {/* Correlation ID */}
            {message.properties.correlation_id && (
              <div className="p-3 bg-[#06070a] border border-[#232838] flex flex-col justify-between sm:col-span-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                  <span className="text-amber-500/90 font-bold">Correlation ID (RPC)</span>
                  <button
                    onClick={handleCopyCorrelationId}
                    className="text-zinc-400 hover:text-white flex items-center gap-1 text-[9px]"
                  >
                    {copiedId ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    <span>{copiedId ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <span className="text-amber-300 font-mono select-all break-all">
                  {message.properties.correlation_id}
                </span>
              </div>
            )}

            {/* Reply-To */}
            {message.properties.reply_to && (
              <div className="p-3 bg-[#06070a] border border-[#232838] flex flex-col justify-between md:col-span-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                  <CornerDownRight className="size-3 text-cyan-400" />
                  <span className="text-cyan-400">Reply-To Address</span>
                </div>
                <span className="text-cyan-300 font-mono text-[11px] select-all break-all">
                  {message.properties.reply_to}
                </span>
              </div>
            )}
          </div>

          {/* Custom Headers Accordion/Table */}
          {hasHeaders && (
            <div className="p-3.5 bg-[#06070a] border border-[#232838] font-mono text-xs">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-400 mb-2 font-bold">
                <Tag className="size-3" />
                <span>Message Headers ({Object.keys(message.properties.headers || {}).length})</span>
              </div>
              <div className="divide-y divide-zinc-800 text-[11px]">
                {Object.entries(message.properties.headers || {}).map(([key, val]) => (
                  <div key={key} className="py-1.5 flex items-start justify-between gap-4">
                    <span className="text-zinc-500 font-semibold shrink-0">{key}:</span>
                    <span className="text-zinc-300 select-all font-mono text-right break-all">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formatted JSON Payload Inspector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between font-mono text-xs text-zinc-400">
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-300">
                Payload Structure & Data
              </span>
              <span className="text-[10px] text-zinc-500">
                Format: {message.payload_encoding || 'string'}
              </span>
            </div>
            <JsonViewer data={message.payload} maxHeight="max-h-[50vh]" />
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-5 py-3 border-t border-[#232838] bg-[#0c0e14] flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
          {/* Left keyboard hints */}
          <div className="hidden sm:flex items-center gap-3 text-[10px] text-zinc-500">
            <span><kbd className="px-1 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700">←</kbd> <kbd className="px-1 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700">→</kbd> Stepper</span>
            <span><kbd className="px-1 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700">Esc</kbd> Close</span>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="hw-btn-secondary !text-[11px]"
              title="Download payload as JSON file"
            >
              <Download className="size-3.5" /> Download
            </button>

            <button
              type="button"
              onClick={handleCopyPayload}
              className="hw-btn-secondary !text-[11px]"
            >
              {copiedPayload ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> Copy JSON
                </>
              )}
            </button>

            {isHead && onAckHead && (
              <button
                type="button"
                onClick={onAckHead}
                className="hw-btn-danger !text-[11px]"
                title="Acknowledge and delete this message from the head of the queue"
              >
                <Trash2 className="size-3.5" /> Ack Head
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="hw-btn-primary !text-[11px] !py-1.5"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
