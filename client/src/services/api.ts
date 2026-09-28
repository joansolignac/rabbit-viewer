import type { ConnectionProfile, OverviewData, QueueHistoryParams, QueueItem, QueueMessage, VhostItem } from '../types/rabbitmq';

const API_BASE = '/api';

function buildHeaders(profile: ConnectionProfile, extraHeaders: Record<string, string> = {}): HeadersInit {
  return {
    'x-rmq-host': profile.host,
    'x-rmq-port': String(profile.port),
    'x-rmq-proto': profile.protocol,
    'x-rmq-user': profile.user,
    'x-rmq-pass': profile.password ?? '',
    'x-rmq-vhost': profile.vhost || '/',
    ...extraHeaders
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  let json: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    json = await res.json();
  } else {
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: text || `HTTP ${res.status} ${res.statusText}` };
    }
  }

  if (!res.ok) {
    const msg = json?.error || json?.reason || `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return json as T;
}

export async function testConnection(profile: ConnectionProfile) {
  const res = await fetch(`${API_BASE}/test-connection`, {
    method: 'POST',
    headers: buildHeaders(profile),
  });
  return handleResponse<{
    connected: boolean;
    user: string;
    rabbitmqVersion: string;
    erlangVersion: string;
    clusterName: string;
    message: string;
  }>(res);
}

export async function getOverview(profile: ConnectionProfile): Promise<OverviewData> {
  const res = await fetch(`${API_BASE}/overview`, {
    headers: buildHeaders(profile),
  });
  return handleResponse<OverviewData>(res);
}

export async function getVhosts(profile: ConnectionProfile): Promise<VhostItem[]> {
  const res = await fetch(`${API_BASE}/vhosts`, {
    headers: buildHeaders(profile),
  });
  return handleResponse<VhostItem[]>(res);
}

export async function getQueues(profile: ConnectionProfile, vhost?: string): Promise<QueueItem[]> {
  const targetVhost = vhost || profile.vhost || '/';
  const url = `${API_BASE}/queues?vhost=${encodeURIComponent(targetVhost)}`;
  const res = await fetch(url, {
    headers: buildHeaders(profile),
  });
  return handleResponse<QueueItem[]>(res);
}

export async function getQueueDetail(
  profile: ConnectionProfile,
  vhost: string,
  queue: string,
  history?: QueueHistoryParams
): Promise<QueueItem> {
  const encVhost = encodeURIComponent(vhost);
  const encQueue = encodeURIComponent(queue);
  let url = `${API_BASE}/queues/${encVhost}/${encQueue}`;

  if (history) {
    const queryString = new URLSearchParams({
      lengths_age: String(history.lengths_age),
      lengths_incr: String(history.lengths_incr),
      msg_rates_age: String(history.msg_rates_age),
      msg_rates_incr: String(history.msg_rates_incr),
    }).toString();
    url = `${url}?${queryString}`;
  }

  const res = await fetch(url, {
    headers: buildHeaders(profile),
  });
  return handleResponse<QueueItem>(res);
}

export async function peekMessages(
  profile: ConnectionProfile,
  vhost: string,
  queue: string,
  count: number = 10
): Promise<QueueMessage[]> {
  const encVhost = encodeURIComponent(vhost);
  const encQueue = encodeURIComponent(queue);
  const res = await fetch(`${API_BASE}/queues/${encVhost}/${encQueue}/messages`, {
    method: 'POST',
    headers: buildHeaders(profile, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      count,
      ackmode: 'ack_requeue_true' // Keep messages in queue safely
    })
  });
  return handleResponse<QueueMessage[]>(res);
}

export async function ackHeadMessage(
  profile: ConnectionProfile,
  vhost: string,
  queue: string
): Promise<QueueMessage[]> {
  const encVhost = encodeURIComponent(vhost);
  const encQueue = encodeURIComponent(queue);
  const res = await fetch(`${API_BASE}/queues/${encVhost}/${encQueue}/messages`, {
    method: 'POST',
    headers: buildHeaders(profile, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      count: 1,
      ackmode: 'ack_requeue_false' // Delete/ack head message
    })
  });
  return handleResponse<QueueMessage[]>(res);
}

export async function purgeQueue(
  profile: ConnectionProfile,
  vhost: string,
  queue: string
): Promise<{ success: boolean; message: string }> {
  const encVhost = encodeURIComponent(vhost);
  const encQueue = encodeURIComponent(queue);
  const res = await fetch(`${API_BASE}/queues/${encVhost}/${encQueue}/contents`, {
    method: 'DELETE',
    headers: buildHeaders(profile),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}
