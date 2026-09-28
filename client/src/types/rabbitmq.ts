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

export interface MessageStats {
  publish?: number;
  publish_details?: { rate: number };
  deliver_get?: number;
  deliver_get_details?: { rate: number };
  ack?: number;
  ack_details?: { rate: number };
  redeliver?: number;
  redeliver_details?: { rate: number };
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
  messages: number;
  messages_ready: number;
  messages_unacknowledged: number;
  message_bytes?: number;
  message_bytes_ready?: number;
  message_bytes_unacknowledged?: number;
  message_stats?: MessageStats;
  idle_since?: string;
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
