export interface ConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'http' | 'https';
  user: string;
  password?: string;
  vhost: string;
  createdAt: number;
  lastUsedAt?: number;
}

export interface MessageProperties {
  headers?: Record<string, any>;
  correlation_id?: string;
  reply_to?: string;
  content_type?: string;
  content_encoding?: string;
  message_id?: string;
  timestamp?: number;
  delivery_mode?: number;
  priority?: number;
  expiration?: string;
  type?: string;
  user_id?: string;
  app_id?: string;
  cluster_id?: string;
}

export interface QueueMessage {
  payload_bytes: number;
  redelivered: boolean;
  exchange: string;
  routing_key: string;
  message_count: number;
  properties: MessageProperties;
  payload: string;
  payload_encoding: string;
}

export interface StatSample {
  sample: number;
  timestamp: number;
}

export interface RateDetails {
  rate: number;
  avg?: number;
  avg_rate?: number;
  samples?: StatSample[];
}

export interface MessageStats {
  publish?: number;
  publish_details?: RateDetails;
  deliver_get?: number;
  deliver_get_details?: RateDetails;
  ack?: number;
  ack_details?: RateDetails;
  redeliver?: number;
  redeliver_details?: RateDetails;
}

export interface ConsumerChannelDetails {
  name?: string;
  number?: number;
  node?: string;
  connection_name?: string;
  peer_host?: string;
  peer_port?: number;
  user?: string;
}

export interface ConsumerDetail {
  consumer_tag?: string;
  // RabbitMQ serialises an empty channel info object as `[]` instead of `{}`.
  channel_details?: ConsumerChannelDetails | unknown[];
  prefetch_count?: number;
  ack_required?: boolean;
  exclusive?: boolean;
  active?: boolean;
  activity_status?: string;
  arguments?: Record<string, any>;
}

export interface QueueItem {
  name: string;
  vhost: string;
  durable: boolean;
  auto_delete: boolean;
  exclusive: boolean;
  arguments: Record<string, any>;
  node: string;
  state: string;
  type: string;
  memory: number;
  consumers: number;
  consumer_capacity?: number;
  consumer_utilisation?: number;
  consumer_details?: ConsumerDetail[];
  messages: number;
  messages_ready: number;
  messages_unacknowledged: number;
  messages_details?: RateDetails;
  messages_ready_details?: RateDetails;
  messages_unacknowledged_details?: RateDetails;
  message_bytes?: number;
  message_bytes_ready?: number;
  message_bytes_unacknowledged?: number;
  message_stats?: MessageStats;
  idle_since?: string;
}

export type HistoryWindowKey = '1m' | '10m' | '1h';

export interface HistoryWindow {
  key: HistoryWindowKey;
  label: string;
  ageSeconds: number;
  incrSeconds: number;
}

export const HISTORY_WINDOWS: HistoryWindow[] = [
  { key: '1m', label: '1 min', ageSeconds: 60, incrSeconds: 5 },
  { key: '10m', label: '10 min', ageSeconds: 600, incrSeconds: 5 },
  { key: '1h', label: '1 h', ageSeconds: 3600, incrSeconds: 60 },
];

export interface QueueHistoryParams {
  lengths_age: number;
  lengths_incr: number;
  msg_rates_age: number;
  msg_rates_incr: number;
}

export interface OverviewData {
  rabbitmq_version?: string;
  erlang_version?: string;
  cluster_name?: string;
  queue_totals?: {
    messages: number;
    messages_ready: number;
    messages_unacknowledged: number;
  };
  object_totals?: {
    queues: number;
    connections: number;
    channels: number;
    consumers: number;
  };
}

export interface VhostItem {
  name: string;
  description?: string;
  tags?: string[];
  tracing?: boolean;
}
