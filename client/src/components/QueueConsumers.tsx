import React from 'react';
import type { QueueItem } from '../types/rabbitmq';
import { Users, Plug, ShieldCheck, AlertTriangle } from 'lucide-react';

interface QueueConsumersProps {
  queue: QueueItem;
}

interface ConsumerRow {
  key: string;
  consumerTag?: string;
  connectionName?: string;
  peerAddress?: string;
  channelLabel?: string;
  user?: string;
  prefetchCount?: number;
  ackRequired?: boolean;
  exclusive?: boolean;
  active?: boolean;
  activityStatus?: string;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

function asBoolean(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

function normalizeConsumers(raw: unknown): ConsumerRow[] {
  if (!Array.isArray(raw)) return [];

  const rows: ConsumerRow[] = [];
  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const consumer = entry as Record<string, unknown>;

    const rawChannel = consumer.channel_details;
    const channel =
      rawChannel && typeof rawChannel === 'object' && !Array.isArray(rawChannel)
        ? (rawChannel as Record<string, unknown>)
        : undefined;

    const consumerTag = asString(consumer.consumer_tag);
    const channelName = asString(channel?.name);
    const channelNumber = asNumber(channel?.number);
    const channelLabel = channelName ?? (channelNumber !== undefined ? `#${channelNumber}` : undefined);

    const peerHost = asString(channel?.peer_host);
    const peerPort = asNumber(channel?.peer_port);
    const peerAddress = peerHost
      ? peerPort !== undefined
        ? `${peerHost}:${peerPort}`
        : peerHost
      : undefined;

    rows.push({
      key: `${channelLabel ?? 'ch'}::${consumerTag ?? ''}::${index}`,
      consumerTag,
      connectionName: asString(channel?.connection_name),
      peerAddress,
      channelLabel,
      user: asString(channel?.user),
      prefetchCount: asNumber(consumer.prefetch_count),
      ackRequired: asBoolean(consumer.ack_required),
      exclusive: asBoolean(consumer.exclusive),
      active: asBoolean(consumer.active),
      activityStatus: asString(consumer.activity_status),
    });
  });

  return rows;
}

function formatPrefetch(n?: number): string {
  if (n === undefined) return '—';
  if (n === 0) return 'unlimited (0)';
  return String(n);
}

export const QueueConsumers: React.FC<QueueConsumersProps> = ({ queue }) => {
  const rows = normalizeConsumers(queue.consumer_details);
  const detailsProvided = Array.isArray(queue.consumer_details);
  const reportedCount = queue.consumers;
  const counterMismatch = rows.length > 0 && rows.length !== reportedCount;
  const hasBacklog = queue.messages_ready > 0;

  return (
    <div className="p-5 bg-[#0e1017] border border-[#232838] space-y-4">
      {/* Header: title + attachment count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#232838]">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-300 font-semibold">
          <Users className="size-4 text-zinc-400" />
          <span>Consumers — Real Attachments</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hw-tag border-zinc-700 text-zinc-400">{rows.length} attached</span>
          <span className="hw-tag border-zinc-700 text-zinc-400">Read-only view</span>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((row) => (
            <div
              key={row.key}
              className="p-3 bg-[#08090d] border border-zinc-800/80 font-mono text-[11px] space-y-3"
            >
              {/* Status tags */}
              <div className="flex flex-wrap items-center gap-1">
                {row.ackRequired === true && (
                  <span className="hw-tag border-emerald-700/60 bg-emerald-950/40 text-emerald-300">
                    ack: manual
                  </span>
                )}
                {row.ackRequired === false && (
                  <span
                    className="hw-tag border-amber-700/60 bg-amber-950/40 text-amber-300"
                    title="Consumer auto-acknowledges on delivery: messages can be lost if the worker crashes before processing them."
                  >
                    auto-ack
                  </span>
                )}
                {row.exclusive === true && (
                  <span className="hw-tag border-zinc-700 text-zinc-300">exclusive</span>
                )}
                {row.activityStatus && (
                  <span className="hw-tag border-zinc-700 text-zinc-400">{row.activityStatus}</span>
                )}
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                {[
                  { label: 'Consumer Tag', value: row.consumerTag },
                  { label: 'Connection', value: row.connectionName },
                  { label: 'Peer (IP:port)', value: row.peerAddress },
                  { label: 'Channel', value: row.channelLabel },
                  { label: 'User', value: row.user },
                  { label: 'Prefetch', value: formatPrefetch(row.prefetchCount) },
                ].map((field) => (
                  <div key={field.label} className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">{field.label}</div>
                    <div className="text-zinc-200 select-all truncate">{field.value ?? '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : reportedCount === 0 ? (
        <div className="p-8 text-center border border-dashed border-[#232838] font-mono">
          <Plug className={`size-8 mx-auto mb-2 ${hasBacklog ? 'text-rose-400' : 'text-zinc-600'}`} />
          <div
            className={`text-xs uppercase tracking-wider ${
              hasBacklog ? 'text-rose-400' : 'text-zinc-400'
            }`}
          >
            No consumers attached
          </div>
          <p className="text-zinc-500 text-[11px] mt-1">
            {hasBacklog
              ? 'Ready messages are waiting in this queue with no worker connected to process them.'
              : 'No active consumers are currently attached to this queue.'}
          </p>
        </div>
      ) : !detailsProvided ? (
        <div className="p-8 text-center border border-dashed border-[#232838] font-mono">
          <ShieldCheck className="size-8 mx-auto text-zinc-600 mb-2" />
          <div className="text-zinc-400 text-xs uppercase tracking-wider">Consumer details unavailable</div>
          <p className="text-zinc-500 text-[11px] mt-1">
            Broker reports {reportedCount} consumers but did not return consumer_details (older RabbitMQ
            version or management stats disabled).
          </p>
        </div>
      ) : (
        <div className="p-8 text-center border border-dashed border-[#232838] font-mono">
          <AlertTriangle className="size-8 mx-auto text-zinc-600 mb-2" />
          <div className="text-zinc-400 text-xs uppercase tracking-wider">Consumer list unreadable</div>
          <p className="text-zinc-500 text-[11px] mt-1">
            Broker reports {reportedCount} consumers but returned an empty consumer_details list, or a
            format this viewer does not recognise.
          </p>
        </div>
      )}

      {counterMismatch && (
        <div className="font-mono text-[10px] text-zinc-500">
          Consumer counter ({reportedCount}) and details list ({rows.length}) differ — management stats may
          lag.
        </div>
      )}

      {/* Legend */}
      <div className="pt-3 border-t border-[#232838] font-mono text-[10px] text-zinc-500 leading-relaxed">
        Producers are not listed: RabbitMQ does not bind publishers to a queue, only to
        exchanges/connections at publish time.
      </div>
    </div>
  );
};
