import { Request, Response } from 'express';

export interface BrokerConfig {
  protocol: 'http' | 'https';
  host: string;
  port: number;
  user: string;
  password?: string;
  vhost?: string;
}

export function extractBrokerConfig(req: Request): BrokerConfig {
  const host = (req.headers['x-rmq-host'] as string)?.trim();
  if (!host) {
    throw new Error('Missing x-rmq-host header. Please provide the RabbitMQ host.');
  }

  const port = parseInt((req.headers['x-rmq-port'] as string) || '15672', 10);
  const protocol = ((req.headers['x-rmq-proto'] as string)?.toLowerCase() === 'https') ? 'https' : 'http';
  const user = (req.headers['x-rmq-user'] as string)?.trim() || 'guest';
  const password = (req.headers['x-rmq-pass'] as string) ?? '';
  const vhost = (req.headers['x-rmq-vhost'] as string)?.trim() || '/';

  return {
    protocol,
    host,
    port,
    user,
    password,
    vhost
  };
}

export function encodeVhost(vhost: string): string {
  // RabbitMQ Management API requires default vhost '/' to be encoded as '%2F'
  return encodeURIComponent(vhost);
}

export async function forwardToRabbitMQ(
  config: BrokerConfig,
  endpointPath: string,
  options: {
    method?: string;
    body?: any;
    timeoutMs?: number;
  } = {}
): Promise<{ status: number; data: any; ok: boolean }> {
  const { method = 'GET', body, timeoutMs = 8000 } = options;

  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const targetUrl = `${config.protocol}://${config.host}:${config.port}/api${cleanPath}`;

  const authString = Buffer.from(`${config.user}:${config.password ?? ''}`).toString('base64');

  const headers: Record<string, string> = {
    'Authorization': `Basic ${authString}`,
    'Accept': 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    let responseData: any = null;

    if (contentType.includes('application/json')) {
      responseData = await res.json();
    } else {
      const text = await res.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text || null;
      }
    }

    if (!res.ok) {
      let errorMessage = `RabbitMQ HTTP error ${res.status}: ${res.statusText}`;
      if (res.status === 401) {
        errorMessage = 'Authentication failed. Please verify RabbitMQ username and password.';
      } else if (res.status === 404) {
        errorMessage = `Resource not found on RabbitMQ (${endpointPath}). Verify queue or vhost name.`;
      } else if (res.status === 403) {
        errorMessage = 'Access denied. User does not have permission for this vhost/queue.';
      } else if (responseData && typeof responseData === 'object' && responseData.reason) {
        errorMessage = `RabbitMQ error: ${responseData.reason}`;
      }

      return {
        status: res.status,
        data: { error: errorMessage, details: responseData },
        ok: false
      };
    }

    return {
      status: res.status,
      data: responseData,
      ok: true
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return {
        status: 504,
        data: {
          error: `Connection timed out after ${timeoutMs / 1000}s. Broker at ${config.host}:${config.port} did not respond.`,
          code: 'ETIMEDOUT'
        },
        ok: false
      };
    }

    let message = err.message || 'Unknown network error';
    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      message = `Connection refused at ${config.host}:${config.port}. Is RabbitMQ running and Management plugin (default port 15672) enabled?`;
    } else if (err.cause?.code === 'ENOTFOUND' || err.message?.includes('ENOTFOUND')) {
      message = `Host "${config.host}" not found. Verify DNS or IP address.`;
    }

    return {
      status: 502,
      data: { error: message, code: err.cause?.code || err.code || 'PROXY_ERROR' },
      ok: false
    };
  }
}
