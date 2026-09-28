import React, { useEffect, useState } from 'react';
import type { QueueItem, QueueMessage } from '../types/rabbitmq';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Inbox,
  Layers,
  Send,
  Users,
  ChevronLeft,
  ChevronRight,
  Copy,
  Maximize2,
} from 'lucide-react';

interface QueueConveyorProps {
  queue: QueueItem;
  messages: QueueMessage[];
  isStuck: boolean;
  selectedIndex: number | null;
  onSelectMessage: (index: number) => void;
  onOpenModal: (index: number) => void;
  accentColor?: string;
}

function formatRate(value?: number): string {
  const rate = value ?? 0;
  const decimals = rate < 10 ? 2 : 1;
  return `${rate.toFixed(decimals)}/s`;
}

type ConveyorSlotItem =
  | { type: 'message'; message: QueueMessage; index: number }
  | { type: 'placeholder'; index: number };

export const QueueConveyor: React.FC<QueueConveyorProps> = ({
  queue,
  messages,
  isStuck,
  selectedIndex,
  onSelectMessage,
  onOpenModal,
  accentColor = '#ffffff',
}) => {
  const publishRate = queue.message_stats?.publish_details?.rate ?? 0;
  const deliverRate = queue.message_stats?.deliver_get_details?.rate ?? 0;
  const ackRate = queue.message_stats?.ack_details?.rate ?? 0;

  // Total messages the queue actually holds. The peeked buffer can be smaller
  // than the queue, so this is the reference for the collapsed overflow chip.
  const totalMessages = Math.max(queue.messages_ready, messages.length);
  const isEmpty = queue.messages_ready === 0 && queue.messages_unacknowledged === 0;
  const consumersDown = isStuck || queue.consumers === 0;

  // Selected message details
  const activeMessage = selectedIndex !== null && messages[selectedIndex] ? messages[selectedIndex] : null;

  const handlePrev = () => {
    if (selectedIndex === null || selectedIndex <= 0) {
      onSelectMessage(messages.length - 1);
    } else {
      onSelectMessage(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex === null || selectedIndex >= messages.length - 1) {
      onSelectMessage(0);
    } else {
      onSelectMessage(selectedIndex + 1);
    }
  };

  const handleCopyPayload = (payload: string) => {
    navigator.clipboard.writeText(
      typeof payload === 'object' ? JSON.stringify(payload, null, 2) : payload
    );
  };

  // Paginated pipeline: PAGE_SIZE messages are shown per page, with a trailing
  // "+N" chip that jumps to the next batch. The two tail slots of the queue are
  // preserved as placeholders when the head-only peek window does not reach them.
  const PAGE_SIZE = 6;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(totalMessages / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, totalMessages);

  // New queue or new peek: go back to the first page.
  useEffect(() => {
    setPage(1);
  }, [queue.name, messages.length]);

  // Keep the current page in range as the queue grows or shrinks.
  useEffect(() => {
    setPage((value) => Math.min(value, pageCount));
  }, [pageCount]);

  // Follow the selected message onto its page (e.g. when stepping in the modal).
  useEffect(() => {
    if (selectedIndex === null) return;
    const target = Math.floor(selectedIndex / PAGE_SIZE) + 1;
    setPage((value) => (value === target ? value : target));
  }, [selectedIndex]);

  const slots: ConveyorSlotItem[] = [];
  for (let i = pageStart; i < pageEnd; i++) {
    if (i < messages.length) {
      slots.push({ type: 'message', message: messages[i], index: i });
    } else {
      slots.push({ type: 'placeholder', index: i });
    }
  }

  const remaining = Math.max(0, totalMessages - pageEnd);

  // Compact page number list, e.g. 1 … 4 5 6 … 12
  const pageItems: (number | 'ellipsis')[] = (() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const items: (number | 'ellipsis')[] = [1];
    const from = Math.max(2, currentPage - 1);
    const to = Math.min(pageCount - 1, currentPage + 1);
    if (from > 2) items.push('ellipsis');
    for (let p = from; p <= to; p++) items.push(p);
    if (to < pageCount - 1) items.push('ellipsis');
    items.push(pageCount);
    return items;
  })();

  return (
    <div className="p-5 bg-[#0e1017] border border-[#232838] space-y-4 font-mono">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#232838]">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-200 font-bold">
          <Layers className="size-4" style={{ color: accentColor }} />
          <span>Real Queue — Architecture Conveyor</span>
          <span className="hw-tag border-zinc-800 text-zinc-400 bg-zinc-900/80 font-normal">
            FIFO: #1 Head → #{totalMessages} Tail
          </span>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenModal(selectedIndex ?? 0)}
              className="hw-btn-secondary !text-xs !py-1 !px-2.5 flex items-center gap-1.5 hover:border-zinc-400"
              title="Open full structure inspection modal for all peeked messages"
            >
              <Maximize2 className="size-3" style={{ color: accentColor }} />
              <span>VIEW ALL MESSAGES ({messages.length})</span>
            </button>
          )}

          {selectedIndex !== null && messages[selectedIndex] && (
            <span
              className="hw-tag font-bold border-zinc-400 text-black px-2 py-0.5 cursor-pointer bg-white"
              style={{ backgroundColor: accentColor }}
              onClick={() => onOpenModal(selectedIndex)}
              title="Click to open full structure modal"
            >
              #{selectedIndex + 1} Selected ↗
            </span>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div className="p-8 text-center border border-dashed border-[#232838] font-mono">
          <Inbox className="size-8 mx-auto text-zinc-600 mb-2" />
          <div className="text-zinc-400 text-xs uppercase tracking-wider">Queue is empty</div>
          <p className="text-zinc-500 text-[11px] mt-1">
            No ready or unacknowledged messages are currently in this queue.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pagination Bar */}
          {pageCount > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                Showing <span className="text-zinc-300 font-bold">#{pageStart + 1}–#{pageEnd}</span> of{' '}
                <span className="text-zinc-300 font-bold">#{totalMessages}</span>
                <span className="text-zinc-600"> · page {currentPage}/{pageCount}</span>
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={currentPage === 1}
                  className="hw-btn-secondary !px-2 !py-0.5 !text-[10px] disabled:opacity-30"
                  title="First page"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="hw-btn-secondary !px-2 !py-0.5 !text-[10px] disabled:opacity-30 flex items-center"
                  title="Previous page"
                >
                  <ChevronLeft className="size-3" />
                </button>

                {pageItems.map((item, idx) =>
                  item === 'ellipsis' ? (
                    <span key={`gap-${idx}`} className="px-1 text-zinc-600 text-[10px]">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={`min-w-[24px] px-1.5 py-0.5 text-[10px] font-mono border transition-colors ${
                        item === currentPage
                          ? 'text-black font-bold'
                          : 'text-zinc-300 border-zinc-700 hover:border-zinc-400 hover:text-white'
                      }`}
                      style={
                        item === currentPage
                          ? { backgroundColor: accentColor, borderColor: accentColor }
                          : undefined
                      }
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                  disabled={currentPage === pageCount}
                  className="hw-btn-secondary !px-2 !py-0.5 !text-[10px] disabled:opacity-30 flex items-center"
                  title="Next page"
                >
                  <ChevronRight className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(pageCount)}
                  disabled={currentPage === pageCount}
                  className="hw-btn-secondary !px-2 !py-0.5 !text-[10px] disabled:opacity-30"
                  title="Last page"
                >
                  »
                </button>
              </div>
            </div>
          )}

          {/* Architecture Conveyor Belt Flow */}
          <div className="overflow-x-auto pb-2">
            <div className="flex items-center gap-3 min-w-max pt-6 pb-4 px-2">
              {/* 1. Producers Node */}
              <div className="shrink-0 w-32 p-3 bg-[#08090d] border border-zinc-800/80 flex flex-col items-center text-center gap-1">
                <Send className={`size-4 ${publishRate > 0 ? 'text-matrix-info animate-pulse' : 'text-zinc-600'}`} />
                <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  Producers
                </div>
                <div className="font-mono text-sm font-bold text-matrix-info">{formatRate(publishRate)}</div>
                <span className="text-[9px] font-mono text-zinc-600">publish rate</span>
              </div>

              {/* Inflow Arrow */}
              <div className="shrink-0 flex items-center text-zinc-600">
                <ArrowRight className={`size-4 ${publishRate > 0 ? 'text-matrix-info animate-pulse' : ''}`} />
              </div>

              {/* 2. Real Queue Pipeline: head slots → single overflow chip → tail slots */}
              <div className="flex items-center gap-2 p-2.5 bg-[#08090d] border border-zinc-800 rounded-none relative">
                {/* Pipeline Flow Label */}
              <div className="absolute -top-4 left-3 font-mono text-[9px] uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-bold">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: accentColor }}></span>
                <span>Queue Pipeline (FIFO: #1 Head → #{totalMessages} Tail)</span>
              </div>

                {/* Left message-navigation arrow */}
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={messages.length === 0}
                  className="shrink-0 w-7 h-20 flex items-center justify-center border border-zinc-800 bg-[#0b0d12] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-30 cursor-pointer"
                  title="Previous message (←)"
                >
                  <ChevronLeft className="size-4" />
                </button>

                {slots.map((item) => {
                  if (item.type === 'placeholder') {
                    const { index } = item;
                    const isTail = index === totalMessages - 1;
                    return (
                      <div key={`placeholder-${index}`} className="flex flex-col items-center relative">
                        <div
                          title={`Message #${index + 1} is outside the loaded peek window (currently #1–#${Math.min(messages.length, totalMessages)} loaded). The capture is head-only, so the real tail cannot be inspected non-destructively.`}
                          className="shrink-0 w-16 h-20 p-1.5 border border-dashed border-zinc-700/70 bg-[#0b0c11] flex flex-col justify-between items-center text-zinc-600 select-none"
                        >
                          <div className="w-full flex items-center justify-between text-[9px] font-mono leading-none">
                            <span className="font-bold text-zinc-500">#{index + 1}</span>
                            {isTail && (
                              <span className="px-1 py-0.2 bg-zinc-800/80 text-zinc-500 font-bold text-[8px]">TAIL</span>
                            )}
                          </div>
                          <div className="my-auto flex items-center justify-center">
                            <Inbox className="size-3.5" />
                          </div>
                          <div className="w-full text-center font-mono text-[8px] uppercase tracking-tight">
                            not peeked
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const { message, index } = item;
                  const isHead = index === 0;
                  const isTail = index === totalMessages - 1;
                  const isSelected = selectedIndex === index;

                  return (
                    <div key={`msg-${index}`} className="flex flex-col items-center relative">
                      {/* Active Beacon Arrow above selected slot */}
                      {isSelected && (
                        <div className="absolute -top-5 flex flex-col items-center animate-bounce">
                          <span
                            className="font-mono text-[8px] font-bold uppercase px-1 rounded-sm text-black"
                            style={{ backgroundColor: accentColor }}
                          >
                            #{index + 1}
                          </span>
                          <span
                            className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px]"
                            style={{ borderTopColor: accentColor }}
                          ></span>
                        </div>
                      )}

                      {/* Packet Slot Card (Click opens Modal!) */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMessage(index);
                          onOpenModal(index);
                        }}
                        title={`Click to inspect #${index + 1} structure in Modal · ${message.routing_key || '<empty>'} · ${message.payload_bytes} bytes`}
                        className={`relative shrink-0 w-16 h-20 p-1.5 border flex flex-col justify-between items-center transition-all cursor-pointer group ${
                          isSelected
                            ? 'scale-105 z-10 shadow-lg border-2'
                            : 'hover:scale-105 hover:border-zinc-400'
                        } ${
                          isSelected
                            ? 'bg-[#181d28]'
                            : isHead
                            ? 'border-white/80 bg-white/10'
                            : message.redelivered
                            ? 'border-rose-600/70 bg-rose-950/30'
                            : 'border-[#232838] bg-[#12141d]'
                        }`}
                        style={{
                          borderColor: isSelected ? accentColor : undefined,
                          boxShadow: isSelected ? `0 0 18px ${accentColor}55` : undefined,
                        }}
                      >
                        {/* Top Badge: Head or Tail */}
                        <div className="w-full flex items-center justify-between text-[9px] font-mono leading-none">
                          <span className="font-bold text-zinc-300">#{index + 1}</span>
                          {isHead ? (
                            <span className="px-1 py-0.2 bg-white text-black font-extrabold text-[8px]">
                              HEAD
                            </span>
                          ) : isTail ? (
                            <span className="px-1 py-0.2 bg-zinc-800 text-zinc-400 font-bold text-[8px]">
                              TAIL
                            </span>
                          ) : null}
                        </div>

                        {/* Center Icon: Redelivered or Normal Packet */}
                        <div className="my-auto flex items-center justify-center">
                          {message.redelivered ? (
                            <AlertTriangle className="size-4 text-rose-400" />
                          ) : (
                            <div className="size-3.5 border border-zinc-600 bg-zinc-800/80 rounded-none flex items-center justify-center">
                              <span className="size-1 rounded-full bg-emerald-400"></span>
                            </div>
                          )}
                        </div>

                        {/* Bottom: Payload Size */}
                        <div className="w-full text-center font-mono text-[9px] text-zinc-400 truncate">
                          {message.payload_bytes}B
                        </div>
                      </button>
                    </div>
                  );
                })}

                {/* Remaining messages past this page: open the inspector on the next batch */}
                {remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = Math.min(pageEnd, Math.max(0, messages.length - 1));
                      onSelectMessage(target);
                      onOpenModal(target);
                    }}
                    className="shrink-0 flex flex-col items-center justify-between p-1.5 w-16 h-20 bg-[#080a10] border border-dashed border-zinc-700/80 hover:border-zinc-400 hover:bg-[#0f121a] transition-all cursor-pointer font-mono group"
                    title={`Open the remaining ${remaining} message${remaining === 1 ? '' : 's'} in the inspector`}
                  >
                    <span className="text-zinc-400 group-hover:text-white font-bold tracking-widest text-xs">···</span>
                    <div className="flex flex-col items-center">
                      <span className="text-zinc-300 group-hover:text-white font-bold text-[11px]">+{remaining}</span>
                      <span className="text-[8px] text-zinc-500 uppercase tracking-tight">msgs</span>
                    </div>
                    <span
                      className="text-[8px] uppercase tracking-wider font-semibold group-hover:underline"
                      style={{ color: accentColor }}
                    >
                      INSPECT ↗
                    </span>
                  </button>
                )}

                {/* Right message-navigation arrow */}
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={messages.length === 0}
                  className="shrink-0 w-7 h-20 flex items-center justify-center border border-zinc-800 bg-[#0b0d12] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-30 cursor-pointer"
                  title="Next message (→)"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* Delivery Arrow */}
              <div className="shrink-0 flex items-center text-zinc-600">
                <ArrowRight className={`size-4 ${deliverRate > 0 ? 'text-matrix-success animate-pulse' : ''}`} />
              </div>

              {/* 3. In-flight (Unacked) Node */}
              <div
                className={`shrink-0 w-28 p-2.5 bg-[#08090d] border flex flex-col items-center text-center gap-1 transition-all ${
                  queue.messages_unacknowledged > 0
                    ? 'border-amber-600/80 shadow-[0_0_15px_rgba(245,158,11,0.15)] bg-amber-950/10'
                    : 'border-zinc-800/80'
                }`}
              >
                <Clock
                  className={`size-3.5 ${
                    queue.messages_unacknowledged > 0 ? 'text-amber-400 animate-pulse' : 'text-zinc-600'
                  }`}
                />
                <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                  In Flight
                </div>
                <div
                  className={`font-mono text-base font-bold ${
                    queue.messages_unacknowledged > 0 ? 'text-amber-300' : 'text-zinc-200'
                  }`}
                >
                  {queue.messages_unacknowledged}
                </div>
                <span className="hw-tag border-amber-700/60 bg-amber-950/40 text-amber-300 text-[8px] uppercase tracking-wider">
                  unacked
                </span>
              </div>

              {/* Final Delivery Arrow */}
              <div className="shrink-0 flex items-center text-zinc-600">
                <ArrowRight className={`size-4 ${deliverRate > 0 ? 'text-matrix-success animate-pulse' : ''}`} />
              </div>

              {/* 4. Consumers Node (Alert if Stuck) */}
              <div
                className={`shrink-0 w-36 p-2.5 bg-[#08090d] border flex flex-col items-center text-center gap-1 transition-all ${
                  consumersDown
                    ? 'border-rose-600/80 shadow-[0_0_15px_rgba(225,29,72,0.25)] bg-rose-950/15'
                    : 'border-emerald-800/80 bg-emerald-950/10'
                }`}
              >
                <Users
                  className={`size-4 ${
                    consumersDown ? 'text-rose-400 animate-pulse' : 'text-matrix-success'
                  }`}
                />
                <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                  Consumers
                </div>
                <div
                  className={`font-mono text-base font-bold ${
                    consumersDown ? 'text-rose-400' : 'text-matrix-success'
                  }`}
                >
                  {queue.consumers} {consumersDown ? 'STUCK' : 'ACTIVE'}
                </div>
                <div className="font-mono text-[9px] text-zinc-400">
                  deliver {formatRate(deliverRate)}
                </div>
                <div className="font-mono text-[9px] text-zinc-500">
                  ack {formatRate(ackRate)}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Selected Message Architecture Telemetry Dock */}
          {activeMessage && selectedIndex !== null && (
            <div
              className="p-3.5 bg-[#080a0f] border font-mono text-xs space-y-2 transition-all"
              style={{
                borderLeftColor: accentColor,
                borderLeftWidth: '3px',
                borderColor: '#232838',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="font-bold uppercase tracking-wider px-2 py-0.5 text-black text-[10px]"
                    style={{ backgroundColor: accentColor }}
                  >
                    Active Message #{selectedIndex + 1} of {messages.length}
                  </span>
                  {selectedIndex === 0 && (
                    <span className="hw-tag border-zinc-500 text-zinc-200 bg-zinc-800/80 font-bold">
                      HEAD OF QUEUE (NEXT TO CONSUME)
                    </span>
                  )}
                  {activeMessage.redelivered && (
                    <span className="hw-tag border-rose-600 text-rose-300 bg-rose-950/40 font-bold flex items-center gap-1">
                      <AlertTriangle className="size-3 text-rose-400" /> REDELIVERED
                    </span>
                  )}
                  <span className="text-zinc-500 text-[10px]">
                    Size: <strong className="text-zinc-300">{activeMessage.payload_bytes} bytes</strong>
                  </span>
                </div>

                {/* Stepper Controls in Conveyor + Inspect Modal Trigger */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => onOpenModal(selectedIndex)}
                    className="hw-btn-primary !px-2.5 !py-1 !text-[10px] flex items-center gap-1"
                    title="Open full structure in modal"
                  >
                    <Maximize2 className="size-3" /> Inspect Structure Modal
                  </button>

                  <button
                    type="button"
                    onClick={handlePrev}
                    className="hw-btn-secondary !px-2 !py-0.5 !text-[10px]"
                    title="Previous Message (←)"
                  >
                    <ChevronLeft className="size-3" /> Prev
                  </button>
                  <span className="text-[10px] text-zinc-500 px-1">
                    {selectedIndex + 1}/{messages.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="hw-btn-secondary !px-2 !py-0.5 !text-[10px]"
                    title="Next Message (→)"
                  >
                    Next <ChevronRight className="size-3" />
                  </button>
                </div>
              </div>

              {/* Message Metadata Snippet */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 pt-2 border-t border-zinc-800/80 text-[11px]">
                <div className="md:col-span-4 flex items-center gap-1.5 truncate">
                  <span className="text-zinc-500 uppercase text-[10px]">Routing Key:</span>
                  <span className="text-zinc-200 font-semibold truncate select-all">
                    {activeMessage.routing_key || '<none>'}
                  </span>
                </div>
                <div className="md:col-span-5 flex items-center gap-1.5 truncate">
                  <span className="text-zinc-500 uppercase text-[10px]">Correlation ID:</span>
                  <span className="text-amber-300 font-mono truncate select-all">
                    {activeMessage.properties.correlation_id || '<none>'}
                  </span>
                </div>
                <div className="md:col-span-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyPayload(activeMessage.payload)}
                    className="font-mono text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                    title="Copy payload"
                  >
                    <Copy className="size-3" /> Copy Payload
                  </button>
                </div>
              </div>

              {/* Payload One-Line Teaser */}
              <div
                className="p-1.5 bg-[#040508] border border-zinc-800 text-[10px] text-zinc-400 font-mono truncate cursor-pointer hover:border-zinc-600 transition-colors"
                onClick={() => onOpenModal(selectedIndex)}
                title="Click to open full structure in modal"
              >
                <span className="text-zinc-600 mr-1.5">preview:</span>
                <span className="text-zinc-300 select-all">
                  {typeof activeMessage.payload === 'string'
                    ? activeMessage.payload.replace(/\s+/g, ' ').slice(0, 140)
                    : JSON.stringify(activeMessage.payload).slice(0, 140)}
                  ...
                </span>
                <span className="ml-2 text-zinc-300 text-[9px] underline">click to view full JSON ↗</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conveyor Legend */}
      <div className="pt-2 border-t border-[#232838] font-mono text-[10px] text-zinc-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <span className="text-zinc-400 uppercase tracking-wider">Queue Order:</span> Head (#1) is next in line to exit to Consumers; Tail is where new messages arrive.
        </div>
        <div>
          Showing <span className="text-zinc-300 font-bold">{messages.length}</span> peeked ·{' '}
          <span className="text-amber-400 font-bold">{queue.messages_ready}</span> ready ·{' '}
          <span className="text-zinc-300 font-bold">{queue.messages_unacknowledged}</span> in flight
        </div>
      </div>
    </div>
  );
};
