import React, { useState, useEffect, useRef } from 'react';
import type { QueueItem, QueueMessage, ConnectionProfile, HistoryWindowKey } from '../types/rabbitmq';
import { HISTORY_WINDOWS } from '../types/rabbitmq';
import { peekMessages, ackHeadMessage, purgeQueue, getQueueDetail } from '../services/api';
import { ConfirmModal } from './ConfirmModal';
import { QueueThroughput } from './QueueThroughput';
import { QueueConveyor } from './QueueConveyor';
import { QueueConsumers } from './QueueConsumers';
import { MessageModal } from './MessageModal';
import {
  ArrowLeft,
  Eye,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Layers,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Maximize2,
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
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(0);
  const [modalMessageIndex, setModalMessageIndex] = useState<number | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [peekCount, setPeekCount] = useState(10);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Historical throughput window (defaults to 10 minutes)
  const [historyWindow, setHistoryWindow] = useState<HistoryWindowKey>('10m');
  const queueRequestSeq = useRef(0);

  // Auto-refresh interval (in seconds, 0 = off)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5);

  // Modals
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [ackHeadModalOpen, setAckHeadModalOpen] = useState(false);

  const fetchQueueData = async (windowKey: HistoryWindowKey = historyWindow) => {
    const seq = ++queueRequestSeq.current;
    const windowDef = HISTORY_WINDOWS.find((item) => item.key === windowKey) ?? HISTORY_WINDOWS[1];
    try {
      setLoadingQueue(true);
      const data = await getQueueDetail(activeProfile, vhost, queueName, {
        lengths_age: windowDef.ageSeconds,
        lengths_incr: windowDef.incrSeconds,
        msg_rates_age: windowDef.ageSeconds,
        msg_rates_incr: windowDef.incrSeconds,
      });
      if (seq !== queueRequestSeq.current) return;
      setQueue(data);
      setErrorMessage(null);
    } catch (err: any) {
      if (seq !== queueRequestSeq.current) return;
      setErrorMessage(err.message || 'Failed to load queue status');
    } finally {
      if (seq === queueRequestSeq.current) setLoadingQueue(false);
    }
  };

  const handleWindowChange = (key: HistoryWindowKey) => {
    setHistoryWindow(key);
    fetchQueueData(key);
  };

  const handlePeekMessages = async (count: number = peekCount) => {
    try {
      setLoadingMessages(true);
      setErrorMessage(null);
      const msgs = await peekMessages(activeProfile, vhost, queueName, count);
      setMessages(msgs);
      if (msgs.length > 0) {
        setSelectedMessageIndex(0);
      }
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
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, queueName, vhost, activeProfile.id, historyWindow]);

  const isStuck = queue ? (queue.messages_ready > 0 && queue.consumers === 0) : false;

  return (
    <div className="space-y-6 animate-fade-in font-mono">
      {/* Top Navigation & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="text-xs uppercase tracking-wider text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Queues List</span>
        </button>

        <div className="flex items-center gap-2 text-xs">
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
            <RefreshCw className={`size-3 ${loadingQueue || loadingMessages ? 'animate-spin text-white' : ''}`} />
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
              <div className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
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
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
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
            <p className="mt-1 text-[11px] text-zinc-400 flex items-center gap-2">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="p-3 bg-[#08090d] border border-zinc-800/80">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Ready Messages</div>
            <div className={`text-xl font-bold mt-1 ${isStuck ? 'text-rose-400' : 'text-amber-400'}`}>
              {queue?.messages_ready ?? '...'}
            </div>
          </div>
          <div className="p-3 bg-[#08090d] border border-zinc-800/80">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Unacknowledged (In-Flight)</div>
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

      {/* Historical Throughput & Peaks */}
      <QueueThroughput
        queue={queue}
        windowKey={historyWindow}
        onWindowChange={handleWindowChange}
        loading={loadingQueue}
      />

      {/* Messages Peek Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#0e1017] border border-[#232838]">
        {/* Left: Peek Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400">Peek Count:</span>
            <select
              value={peekCount}
              onChange={(e) => {
                const count = Number(e.target.value);
                setPeekCount(count);
                handlePeekMessages(count);
              }}
              className="bg-[#06070a] border border-zinc-700 text-zinc-200 px-2 py-1 text-xs font-mono focus:outline-none focus:border-white cursor-pointer"
            >
              <option value={5}>5 msgs</option>
              <option value={10}>10 msgs</option>
              <option value={20}>20 msgs</option>
              <option value={50}>50 msgs</option>
              <option value={100}>100 msgs</option>
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

        {/* Right: Quick Buffer Telemetry */}
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Conveyor Buffer:</span>
          <span className="text-zinc-200 font-bold">{messages.length} peeked</span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setModalMessageIndex(selectedMessageIndex ?? 0)}
              className="hw-btn-secondary !text-xs !py-1 !px-2.5 flex items-center gap-1 ml-2"
              title="Inspect peeked messages in modal"
            >
              <Maximize2 className="size-3" style={{ color: accentColor }} />
              <span>VIEW ALL MESSAGES ({messages.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Errors */}
      {errorMessage && (
        <div className="p-3 bg-rose-950/40 border border-rose-600 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successNotice && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/60 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Real Queue Conveyor Belt (Architecture Conveyor) */}
      {queue && (
        <QueueConveyor
          queue={queue}
          messages={messages}
          isStuck={isStuck}
          selectedIndex={selectedMessageIndex}
          onSelectMessage={(idx) => setSelectedMessageIndex(idx)}
          onOpenModal={(idx) => setModalMessageIndex(idx)}
          accentColor={accentColor}
        />
      )}

      {/* Real Consumers Attached */}
      {queue && <QueueConsumers queue={queue} />}

      {/* Full Structure Message Modal */}
      <MessageModal
        isOpen={modalMessageIndex !== null}
        onClose={() => setModalMessageIndex(null)}
        message={modalMessageIndex !== null && messages[modalMessageIndex] ? messages[modalMessageIndex] : null}
        index={modalMessageIndex}
        totalMessages={messages.length}
        onPrev={() => {
          if (modalMessageIndex !== null) {
            const prev = modalMessageIndex > 0 ? modalMessageIndex - 1 : messages.length - 1;
            setModalMessageIndex(prev);
            setSelectedMessageIndex(prev);
          }
        }}
        onNext={() => {
          if (modalMessageIndex !== null) {
            const next = modalMessageIndex < messages.length - 1 ? modalMessageIndex + 1 : 0;
            setModalMessageIndex(next);
            setSelectedMessageIndex(next);
          }
        }}
        onAckHead={handleAckHead}
        accentColor={accentColor}
      />

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
