import React, { useState, useEffect } from 'react';
import type { QueueItem, QueueMessage, ConnectionProfile } from '../types/rabbitmq';
import { peekMessages, ackHeadMessage, purgeQueue, getQueueDetail } from '../services/api';
import { JsonViewer } from './JsonViewer';
import { ConfirmModal } from './ConfirmModal';
import {
  ArrowLeft,
  Eye,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Layers,
  Inbox,
  Clock,
  CheckCircle2,
  FileCode,
  Tag,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface QueueDetailProps {
  queueName: string;
  vhost: string;
  activeProfile: ConnectionProfile;
  onBack: () => void;
  accentColor: string;
}

export const QueueDetail: React.FC<QueueDetailProps> = ({
  queueName,
  vhost,
  activeProfile,
  onBack,
  accentColor,
}) => {
  const [queue, setQueue] = useState<QueueItem | null>(null);
  const [messages, setMessages] = useState<QueueMessage[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [peekCount, setPeekCount] = useState(10);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Auto-refresh interval (in seconds, 0 = off)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5);

  // Layout mode: 'pipeline' (horizontal flow) or 'stack' (vertical cards)
  const [viewMode, setViewMode] = useState<'pipeline' | 'stack'>('pipeline');

  // Modals
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [ackHeadModalOpen, setAckHeadModalOpen] = useState(false);

  // Expanded headers state per message index
  const [expandedHeaders, setExpandedHeaders] = useState<Record<number, boolean>>({});

  const toggleHeaders = (idx: number) => {
    setExpandedHeaders((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const fetchQueueData = async () => {
    try {
      setLoadingQueue(true);
      const data = await getQueueDetail(activeProfile, vhost, queueName);
      setQueue(data);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load queue status');
    } finally {
      setLoadingQueue(false);
    }
  };

  const handlePeekMessages = async (count: number = peekCount) => {
    try {
      setLoadingMessages(true);
      setErrorMessage(null);
      const msgs = await peekMessages(activeProfile, vhost, queueName, count);
      setMessages(msgs);
      if (msgs.length === 0) {
        setSuccessNotice('Peek complete: 0 messages returned (queue might be empty or locked).');
      } else {
        setSuccessNotice(`Successfully peeked ${msgs.length} message${msgs.length > 1 ? 's' : ''} (ackmode: requeue).`);
      }
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to peek messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleAckHead = async () => {
    try {
      setLoadingMessages(true);
      setErrorMessage(null);
      await ackHeadMessage(activeProfile, vhost, queueName);
      setSuccessNotice('Head message acknowledged and deleted permanently.');
      setTimeout(() => setSuccessNotice(null), 4000);
      // Refresh status and peek
      await fetchQueueData();
      await handlePeekMessages();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to ack message');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handlePurgeQueue = async () => {
    try {
      setLoadingQueue(true);
      setErrorMessage(null);
      await purgeQueue(activeProfile, vhost, queueName);
      setMessages([]);
      setSuccessNotice(`Queue "${queueName}" purged completely.`);
      setTimeout(() => setSuccessNotice(null), 4000);
      await fetchQueueData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to purge queue');
    } finally {
      setLoadingQueue(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchQueueData();
    handlePeekMessages(peekCount);
  }, [queueName, vhost, activeProfile.id]);

  // Auto-refresh effect for queue metrics
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchQueueData();
    } , autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, queueName, vhost, activeProfile.id]);

  const isStuck = queue ? (queue.messages_ready > 0 && queue.consumers === 0) : false;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Navigation & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="font-mono text-xs uppercase tracking-wider text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Queues List</span>
        </button>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-1 bg-[#0e1017] border border-[#232838] px-2.5 py-1">
            <Clock className="size-3 text-zinc-500" />
            <span className="text-[10px] uppercase text-zinc-400">Metrics Auto-Refresh:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-zinc-200 text-xs font-mono focus:outline-none cursor-pointer"
            >
              <option value={0}>Off</option>
              <option value={3}>3s</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
            </select>
          </div>

          <button
            onClick={() => {
              fetchQueueData();
              handlePeekMessages();
            }}
            disabled={loadingQueue || loadingMessages}
            className="hw-btn-secondary !py-1 !px-2.5"
            title="Refresh status and messages"
          >
            <RefreshCw className={`size-3 ${loadingQueue || loadingMessages ? 'animate-spin text-brand-500' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stuck Alert Banner (High Visibility Warning) */}
      {isStuck && (
        <div className="p-4 border-2 border-rose-600 bg-rose-950/20 text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-[0_0_30px_rgba(225,29,72,0.15)]">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-600/20 border border-rose-500 text-rose-400 mt-0.5">
              <AlertTriangle className="size-5 animate-pulse" />
            </div>
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <span>STUCK QUEUE DETECTED</span>
                <span className="hw-tag border-rose-500 bg-rose-900/60 text-white font-mono">
                  0 ACTIVE CONSUMERS
                </span>
              </div>
              <p className="font-sans text-xs text-rose-200 mt-1">
                This queue currently has <strong className="font-mono text-white underline">{queue?.messages_ready} ready messages</strong> waiting in line, but <strong>no worker or consumer is connected</strong> to process them.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => handlePeekMessages(10)}
              className="hw-btn-primary !bg-rose-500 hover:!bg-rose-400 !text-black !py-1.5 !px-3 !text-[11px]"
            >
              <Eye className="size-3.5" />
              Inspect Stuck Messages
            </button>
          </div>
        </div>
      )}

      {/* Queue Identity & Metrics Card */}
      <div className="p-5 bg-[#0e1017] border border-[#232838] relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#232838]">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-mono text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="size-5" style={{ color: accentColor }} />
                <span>{queueName}</span>
              </h2>
              <span className="hw-tag border-zinc-700 text-zinc-400 bg-zinc-900">
                vhost: {vhost}
              </span>
              <span className="hw-tag border-zinc-800 text-zinc-500">
                {queue?.type || 'classic'}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-zinc-400 flex items-center gap-2">
              <span>Node: {queue?.node || '...'}</span>
              <span>•</span>
              <span>Durable: {queue?.durable ? 'YES' : 'NO'}</span>
              <span>•</span>
              <span>Exclusive: {queue?.exclusive ? 'YES' : 'NO'}</span>
            </p>
          </div>

          {/* Destructive Queue Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAckHeadModalOpen(true)}
              disabled={loadingMessages || (queue?.messages_ready === 0 && messages.length === 0)}
              className="hw-btn-secondary !text-rose-400 hover:!border-rose-600 disabled:opacity-40"
              title="Acknowledge and permanently remove the head message"
            >
              <Trash2 className="size-3.5" />
              <span>Ack / Delete Head</span>
            </button>

            <button
              onClick={() => setPurgeModalOpen(true)}
              disabled={loadingQueue || (queue?.messages === 0)}
              className="hw-btn-danger"
              title="Delete all messages from this queue"
            >
              <ShieldAlert className="size-3.5" />
              <span>Purge Entire Queue</span>
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 font-mono">
          <div className="p-3 bg-[#08090d] border border-zinc-800/80">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Ready Messages</div>
            <div className={`text-xl font-bold mt-1 ${isStuck ? 'text-rose-400' : 'text-amber-400'}`}>
              {queue?.messages_ready ?? '...'}
            </div>
          </div>
          <div className="p-3 bg-[#08090d] border border-zinc-800/80">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Unacknowledged</div>
            <div className="text-xl font-bold mt-1 text-zinc-200">
              {queue?.messages_unacknowledged ?? '...'}
            </div>
          </div>
          <div className="p-3 bg-[#08090d] border border-zinc-800/80">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Active Consumers</div>
            <div className={`text-xl font-bold mt-1 ${queue?.consumers === 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {queue?.consumers ?? '...'}
            </div>
          </div>
          <div className="p-3 bg-[#08090d] border border-zinc-800/80">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Memory Used</div>
            <div className="text-xl font-bold mt-1 text-zinc-300">
              {queue?.memory ? `${(queue.memory / 1024).toFixed(1)} KB` : '0 KB'}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Peek & Pipeline Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#0e1017] border border-[#232838]">
        {/* Left: Peek Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400">Peek Count:</span>
            <select
              value={peekCount}
              onChange={(e) => {
                const count = Number(e.target.value);
                setPeekCount(count);
                handlePeekMessages(count);
              }}
              className="bg-[#06070a] border border-zinc-700 text-zinc-200 px-2 py-1 text-xs font-mono focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value={5}>5 msgs</option>
              <option value={10}>10 msgs</option>
              <option value={20}>20 msgs</option>
              <option value={50}>50 msgs</option>
            </select>
          </div>

          <button
            onClick={() => handlePeekMessages(peekCount)}
            disabled={loadingMessages}
            className="hw-btn-primary !py-1 !px-3"
          >
            <Eye className={`size-3.5 ${loadingMessages ? 'animate-pulse' : ''}`} />
            <span>{loadingMessages ? 'Peeking...' : 'Peek Messages (Requeue)'}</span>
          </button>
        </div>

        {/* Right: Layout Switcher */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Layout:</span>
          <div className="flex items-center border border-zinc-800 bg-[#06070a] p-0.5">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-2.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                viewMode === 'pipeline' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              FIFO Pipeline
            </button>
            <button
              onClick={() => setViewMode('stack')}
              className={`px-2.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                viewMode === 'stack' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Stacked Cards
            </button>
          </div>
        </div>
      </div>

      {/* Notifications / Errors */}
      {errorMessage && (
        <div className="p-3 bg-rose-950/40 border border-rose-600 font-mono text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successNotice && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/60 font-mono text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Messages Visual Representation */}
      {messages.length === 0 ? (
        <div className="p-12 text-center bg-[#0e1017] border border-[#232838] font-mono">
          <Inbox className="size-10 mx-auto text-zinc-600 mb-3" />
          <h4 className="text-zinc-300 text-sm font-semibold uppercase tracking-wider">
            No Messages Peeked
          </h4>
          <p className="text-zinc-500 text-xs mt-1 max-w-md mx-auto">
            {queue?.messages_ready === 0
              ? 'This queue is currently empty. Ready messages count is 0.'
              : 'Click "Peek Messages" above to inspect the messages waiting in the queue without consuming them.'}
          </p>
          {queue?.messages_ready && queue.messages_ready > 0 ? (
            <button
              onClick={() => handlePeekMessages(peekCount)}
              className="mt-4 hw-btn-primary inline-flex"
            >
              <Eye className="size-3.5" />
              Peek {peekCount} Messages Now
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between font-mono text-xs text-zinc-400 px-1">
            <span className="uppercase tracking-wider">
              Displaying {messages.length} message{messages.length > 1 ? 's' : ''} in FIFO Order (Head to Tail)
            </span>
            <span className="text-[10px] text-zinc-500">
              * Messages remain safely queued (ackmode: ack_requeue_true)
            </span>
          </div>

          {/* Cards Container: Pipeline (Horizontal scrollable conveyor) vs Stacked */}
          <div
            className={
              viewMode === 'pipeline'
                ? 'flex flex-row gap-4 overflow-x-auto pb-4 snap-x'
                : 'flex flex-col gap-4'
            }
          >
            {messages.map((msg, index) => {
              const isHead = index === 0;
              const hasHeaders = msg.properties.headers && Object.keys(msg.properties.headers).length > 0;
              const isHeadersExpanded = expandedHeaders[index] || false;

              return (
                <div
                  key={index}
                  className={`border bg-[#0e1017] transition-all flex flex-col ${
                    viewMode === 'pipeline' ? 'min-w-[420px] max-w-[480px] shrink-0 snap-start' : 'w-full'
                  } ${
                    isHead
                      ? 'border-brand-500 shadow-[0_0_20px_rgba(255,85,0,0.08)]'
                      : 'border-[#232838] hover:border-zinc-600'
                  }`}
                >
                  {/* Message Card Header */}
                  <div
                    className={`px-4 py-2.5 border-b flex items-center justify-between font-mono text-xs ${
                      isHead
                        ? 'bg-brand-500/10 border-brand-500/30'
                        : 'bg-[#12141e] border-[#232838]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 ${
                          isHead ? 'bg-brand-500 text-black' : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {isHead ? '#1 HEAD OF QUEUE' : `#${index + 1} IN QUEUE`}
                      </span>

                      {msg.redelivered && (
                        <span className="hw-tag border-rose-500/60 bg-rose-950/60 text-rose-300 font-bold flex items-center gap-1">
                          <AlertTriangle className="size-2.5" /> REDELIVERED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                      <span>{msg.payload_bytes} bytes</span>
                      {msg.properties.delivery_mode && (
                        <span className="text-zinc-600">| mode: {msg.properties.delivery_mode}</span>
                      )}
                    </div>
                  </div>

                  {/* Message Metadata Grid */}
                  <div className="p-3 bg-[#08090e] border-b border-[#232838] space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Routing Key:</span>
                      <span className="text-zinc-200 font-semibold select-all">
                        {msg.routing_key || '<empty>'}
                      </span>
                    </div>

                    {msg.exchange && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Exchange:</span>
                        <span className="text-zinc-300 select-all">{msg.exchange}</span>
                      </div>
                    )}

                    {msg.properties.correlation_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-amber-500/80 uppercase tracking-wider text-[10px]">Correlation ID:</span>
                        <span className="text-amber-300 font-bold select-all truncate max-w-[240px]">
                          {msg.properties.correlation_id}
                        </span>
                      </div>
                    )}

                    {msg.properties.reply_to && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Reply-To:</span>
                        <span className="text-cyan-400 select-all truncate max-w-[240px]">
                          {msg.properties.reply_to}
                        </span>
                      </div>
                    )}

                    {/* Headers Accordion */}
                    {hasHeaders && (
                      <div className="pt-1.5 border-t border-zinc-800">
                        <button
                          type="button"
                          onClick={() => toggleHeaders(index)}
                          className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-400 hover:text-zinc-200"
                        >
                          <span className="flex items-center gap-1">
                            <Tag className="size-3 text-zinc-500" />
                            Headers ({Object.keys(msg.properties.headers || {}).length})
                          </span>
                          {isHeadersExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                        </button>

                        {isHeadersExpanded && (
                          <div className="mt-1.5 p-2 bg-black/60 border border-zinc-800 overflow-x-auto text-[10px]">
                            {Object.entries(msg.properties.headers || {}).map(([k, v]) => (
                              <div key={k} className="flex items-start gap-2 py-0.5">
                                <span className="text-zinc-500 font-bold shrink-0">{k}:</span>
                                <span className="text-zinc-300 break-all select-all">
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Formatted Payload Area */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
                        <FileCode className="size-3 text-zinc-500" />
                        <span>Payload Content</span>
                      </div>
                      <JsonViewer data={msg.payload} maxHeight={viewMode === 'pipeline' ? 'max-h-72' : 'max-h-96'} />
                    </div>

                    {/* Card Footer / Individual Action */}
                    {isHead && (
                      <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between font-mono text-[10px]">
                        <span className="text-brand-400 font-semibold uppercase">
                          Next in line to be processed
                        </span>
                        <button
                          onClick={() => setAckHeadModalOpen(true)}
                          className="px-2 py-1 bg-rose-950/40 border border-rose-800 text-rose-300 hover:bg-rose-900/60 uppercase font-semibold transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="size-3" /> Ack / Drop
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={purgeModalOpen}
        onClose={() => setPurgeModalOpen(false)}
        onConfirm={handlePurgeQueue}
        title={`PURGE QUEUE: ${queueName}`}
        description={`Are you sure you want to purge all ${queue?.messages || 0} messages from queue "${queueName}"? This action cannot be undone and will delete all ready and unacknowledged messages.`}
        confirmText="Purge Queue"
        requireMatchWord="PURGE"
        isDangerous={true}
      />

      <ConfirmModal
        isOpen={ackHeadModalOpen}
        onClose={() => setAckHeadModalOpen(false)}
        onConfirm={handleAckHead}
        title={`ACK & DELETE HEAD MESSAGE`}
        description={`This will acknowledge and permanently delete the single message currently at the head of queue "${queueName}". Are you sure you want to proceed?`}
        confirmText="Delete Message"
        isDangerous={true}
      />
    </div>
  );
};
