import React, { useState } from 'react';
import type { QueueItem, ConnectionProfile } from '../types/rabbitmq';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  Users,
  Layers,
  Clock,
  ArrowRight,
  Inbox,
  CheckCircle2,
} from 'lucide-react';

interface QueuesListProps {
  queues: QueueItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectQueue: (queueName: string) => void;
  autoRefreshInterval: number; // in seconds (0 = off)
  onChangeAutoRefresh: (seconds: number) => void;
  activeProfile: ConnectionProfile | null;
  accentColor: string;
}

export const QueuesList: React.FC<QueuesListProps> = ({
  queues,
  isLoading,
  onRefresh,
  onSelectQueue,
  autoRefreshInterval,
  onChangeAutoRefresh,
  activeProfile,
  accentColor,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'stuck' | 'active' | 'empty'>('all');

  // Stuck queue definition: messages_ready > 0 && consumers === 0
  const isQueueStuck = (q: QueueItem) => q.messages_ready > 0 && q.consumers === 0;

  // Filter queues
  const filteredQueues = queues.filter((q) => {
    const matchesSearch = q.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'stuck') {
      return isQueueStuck(q);
    }
    if (filterType === 'active') {
      return q.consumers > 0;
    }
    if (filterType === 'empty') {
      return q.messages === 0;
    }
    return true;
  });

  // Calculate high-level stats
  const totalQueues = queues.length;
  const stuckQueuesCount = queues.filter(isQueueStuck).length;
  const totalReadyMessages = queues.reduce((sum, q) => sum + (q.messages_ready || 0), 0);
  const totalUnackedMessages = queues.reduce((sum, q) => sum + (q.messages_unacknowledged || 0), 0);
  const totalConsumers = queues.reduce((sum, q) => sum + (q.consumers || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Hero Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Queues */}
        <div className="p-4 bg-[#0e1017] border border-[#232838] relative overflow-hidden">
          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            Total Queues
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-white flex items-baseline gap-2">
            {totalQueues}
            <span className="text-[11px] font-mono text-zinc-500 font-normal">in {activeProfile?.vhost || '/'}</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-zinc-500 flex items-center gap-1">
            <Layers className="size-3" />
            <span>Classic & Quorum</span>
          </div>
        </div>

        {/* Stuck Queues Alert Card (Highest Priority) */}
        <div
          className={`p-4 border relative overflow-hidden transition-all ${
            stuckQueuesCount > 0
              ? 'bg-rose-950/20 border-rose-600/60 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
              : 'bg-[#0e1017] border-[#232838]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`font-mono text-[10px] uppercase tracking-widest font-semibold ${
                stuckQueuesCount > 0 ? 'text-rose-400' : 'text-zinc-400'
              }`}
            >
              Stuck Queues
            </span>
            {stuckQueuesCount > 0 && (
              <span className="flex size-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-rose-500"></span>
              </span>
            )}
          </div>
          <div
            className={`mt-2 text-2xl font-mono font-bold flex items-baseline gap-2 ${
              stuckQueuesCount > 0 ? 'text-rose-400' : 'text-zinc-200'
            }`}
          >
            {stuckQueuesCount}
            <span className="text-[11px] font-mono text-zinc-400 font-normal">
              {stuckQueuesCount === 1 ? 'queue stranded' : 'queues stranded'}
            </span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-zinc-400 flex items-center gap-1">
            <AlertTriangle className={`size-3 ${stuckQueuesCount > 0 ? 'text-rose-400' : 'text-zinc-500'}`} />
            <span>Ready &gt; 0 with 0 consumers</span>
          </div>
        </div>

        {/* Ready Messages */}
        <div className="p-4 bg-[#0e1017] border border-[#232838]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            Ready Messages
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-amber-400">
            {totalReadyMessages.toLocaleString()}
          </div>
          <div className="mt-2 text-[10px] font-mono text-zinc-500 flex items-center gap-1">
            <Inbox className="size-3 text-amber-400/80" />
            <span>Awaiting delivery</span>
          </div>
        </div>

        {/* Active Consumers & Unacked */}
        <div className="p-4 bg-[#0e1017] border border-[#232838]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            Consumers / In-Flight
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-white flex items-baseline gap-2">
            <span>{totalConsumers}</span>
            <span className="text-zinc-500 font-normal text-xs">consumers</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-zinc-500 flex items-center gap-1">
            <Users className="size-3 text-emerald-400/80" />
            <span>{totalUnackedMessages} unacknowledged</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Quick Filter Tabs, Auto-Refresh & Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-[#0e1017] border border-[#232838]">
        {/* Left: Search Input & Tabs */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search box */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search queue name..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#06070a] border border-zinc-700 font-mono text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 font-mono text-xs">
            <button
              onClick={() => setFilterType('all')}
              style={{ borderLeftColor: filterType === 'all' ? accentColor : undefined }}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors ${
                filterType === 'all'
                  ? 'bg-zinc-800 text-white font-bold border border-zinc-600 border-l-2'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({queues.length})
            </button>
            <button
              onClick={() => setFilterType('stuck')}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                filterType === 'stuck'
                  ? 'bg-rose-950/60 text-rose-300 font-bold border border-rose-600'
                  : 'text-rose-400/80 hover:text-rose-300'
              }`}
            >
              <AlertTriangle className="size-3 text-rose-400" />
              Stuck ({stuckQueuesCount})
            </button>
            <button
              onClick={() => setFilterType('active')}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors ${
                filterType === 'active'
                  ? 'bg-zinc-800 text-white font-bold border border-zinc-600'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              With Consumers
            </button>
            <button
              onClick={() => setFilterType('empty')}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors ${
                filterType === 'empty'
                  ? 'bg-zinc-800 text-white font-bold border border-zinc-600'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Empty
            </button>
          </div>
        </div>

        {/* Right: Auto-Refresh & Manual Refresh */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-1.5 bg-[#06070a] border border-zinc-800 px-2 py-1">
            <Clock className="size-3 text-zinc-500" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-400">Auto:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => onChangeAutoRefresh(Number(e.target.value))}
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
            onClick={onRefresh}
            disabled={isLoading}
            className="hw-btn-secondary !py-1 !px-2.5"
            title="Refresh queue list"
          >
            <RefreshCw className={`size-3 ${isLoading ? 'animate-spin text-brand-500' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Queues List Grid */}
      {filteredQueues.length === 0 ? (
        <div className="p-12 text-center bg-[#0e1017] border border-[#232838] font-mono">
          <Inbox className="size-8 mx-auto text-zinc-600 mb-3" />
          <h4 className="text-zinc-300 text-sm font-semibold uppercase tracking-wider">
            No queues found
          </h4>
          <p className="text-zinc-500 text-xs mt-1">
            {searchQuery
              ? `No queues matching "${searchQuery}"`
              : filterType === 'stuck'
              ? 'No stuck queues detected! All queues with ready messages have active consumers.'
              : 'No queues available in this virtual host.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredQueues.map((q) => {
            const isStuck = isQueueStuck(q);
            const hasConsumers = q.consumers > 0;

            return (
              <div
                key={q.name}
                onClick={() => onSelectQueue(q.name)}
                className={`p-4 border transition-all cursor-pointer group relative ${
                  isStuck
                    ? 'bg-rose-950/10 border-rose-700/60 hover:border-rose-500 hover:bg-rose-950/20'
                    : 'bg-[#0e1017] border-[#232838] hover:border-zinc-500 hover:bg-[#12141e]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Queue identity & Stuck Alert */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="font-mono text-sm font-bold text-white transition-colors"
                        style={{ color: isStuck ? undefined : undefined }}
                      >
                        {q.name}
                      </span>
                      <span className="hw-tag border-zinc-800 text-zinc-400 bg-zinc-900/80">
                        {q.type || 'classic'}
                      </span>
                      {q.durable && (
                        <span className="hw-tag border-zinc-800 text-zinc-500">
                          durable
                        </span>
                      )}

                      {/* STUCK QUEUE BADGE */}
                      {isStuck && (
                        <span className="hw-tag border-rose-500/80 bg-rose-950/80 text-rose-300 font-bold flex items-center gap-1 animate-pulse-fast">
                          <AlertTriangle className="size-3 text-rose-400" />
                          ⚠️ STUCK: NO ACTIVE CONSUMERS
                        </span>
                      )}

                      {!isStuck && hasConsumers && (
                        <span className="hw-tag border-emerald-800 text-emerald-400 bg-emerald-950/30 flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          HEALTHY ({q.consumers} listening)
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-4 font-mono text-[11px] text-zinc-500">
                      <span>Node: {q.node}</span>
                      <span>•</span>
                      <span>State: {q.state}</span>
                      {q.memory ? (
                        <>
                          <span>•</span>
                          <span>RAM: {(q.memory / 1024).toFixed(1)} KB</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Right: Metrics & Inspection Action */}
                  <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                    {/* Metrics grid */}
                    <div className="flex items-center gap-4 font-mono">
                      {/* Ready Messages */}
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Ready
                        </div>
                        <div
                          className={`text-base font-bold ${
                            q.messages_ready > 0
                              ? isStuck
                                ? 'text-rose-400 font-extrabold'
                                : 'text-amber-400'
                              : 'text-zinc-400'
                          }`}
                        >
                          {q.messages_ready}
                        </div>
                      </div>

                      {/* Unacked Messages */}
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Unacked
                        </div>
                        <div className="text-base font-bold text-zinc-300">
                          {q.messages_unacknowledged}
                        </div>
                      </div>

                      {/* Consumers */}
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Consumers
                        </div>
                        <div
                          className={`text-base font-bold ${
                            q.consumers === 0
                              ? isStuck
                                ? 'text-rose-400'
                                : 'text-zinc-500'
                              : 'text-emerald-400'
                          }`}
                        >
                          {q.consumers}
                        </div>
                      </div>
                    </div>

                    {/* Inspect button */}
                    <button
                      type="button"
                      className="hw-btn-secondary group-hover:border-zinc-400 group-hover:text-white"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
