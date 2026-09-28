import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { extractBrokerConfig, encodeVhost, forwardToRabbitMQ } from './proxy.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'x-rmq-host',
    'x-rmq-port',
    'x-rmq-proto',
    'x-rmq-user',
    'x-rmq-pass',
    'x-rmq-vhost'
  ]
}));
app.use(express.json());

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'rabbit-viewer-proxy', timestamp: new Date().toISOString() });
});

// Middleware to extract broker configuration for protected proxy routes
const requireBrokerConfig = (req: Request, res: Response, next: NextFunction) => {
  try {
    (req as any).brokerConfig = extractBrokerConfig(req);
    next();
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Invalid RabbitMQ configuration in headers' });
  }
};

/**
 * 1. Test Connection
 * Verifies credentials and reachability by querying /api/whoami and /api/overview
 */
app.post('/api/test-connection', requireBrokerConfig, async (req: Request, res: Response) => {
  const config = (req as any).brokerConfig;

  // First check whoami for credentials verification
  const whoamiRes = await forwardToRabbitMQ(config, '/whoami', { timeoutMs: 5000 });
  if (!whoamiRes.ok) {
    return res.status(whoamiRes.status).json(whoamiRes.data);
  }

  // Next get overview info (version, cluster name)
  const overviewRes = await forwardToRabbitMQ(config, '/overview', { timeoutMs: 5000 });
  const overview = overviewRes.ok ? overviewRes.data : {};

  return res.json({
    connected: true,
    user: whoamiRes.data.name,
    tags: whoamiRes.data.tags,
    rabbitmqVersion: overview.rabbitmq_version || 'unknown',
    erlangVersion: overview.erlang_version || 'unknown',
    clusterName: overview.cluster_name || `${config.host}:${config.port}`,
    message: `Connected successfully as "${whoamiRes.data.name}"`
  });
});

/**
 * 2. Get Broker Overview
 */
app.get('/api/overview', requireBrokerConfig, async (req: Request, res: Response) => {
  const config = (req as any).brokerConfig;
  const result = await forwardToRabbitMQ(config, '/overview');
  return res.status(result.status).json(result.data);
});

/**
 * 3. List Virtual Hosts
 */
app.get('/api/vhosts', requireBrokerConfig, async (req: Request, res: Response) => {
  const config = (req as any).brokerConfig;
  const result = await forwardToRabbitMQ(config, '/vhosts');
  return res.status(result.status).json(result.data);
});

/**
 * 4. List Queues for a vhost
 * Supports ?vhost= query param, falling back to header vhost or '/'
 */
app.get('/api/queues', requireBrokerConfig, async (req: Request, res: Response) => {
  const config = (req as any).brokerConfig;
  const targetVhost = (req.query.vhost as string) || config.vhost || '/';
  const encoded = encodeVhost(targetVhost);

  const result = await forwardToRabbitMQ(config, `/queues/${encoded}`);
  return res.status(result.status).json(result.data);
});

/**
 * 5. Get details for a single queue
 */
app.get('/api/queues/:vhost/:queue', requireBrokerConfig, async (req: Request, res: Response) => {
  const config = (req as any).brokerConfig;
  const vhost = String(req.params.vhost);
  const queue = String(req.params.queue);
  const encodedVhost = encodeVhost(vhost);
  const encodedQueue = encodeURIComponent(queue);

  const result = await forwardToRabbitMQ(config, `/queues/${encodedVhost}/${encodedQueue}`);
  return res.status(result.status).json(result.data);
});

/**
 * 6. Peek or Consume Messages from Queue
 * Body: { count?: number, ackmode?: 'ack_requeue_true' | 'ack_requeue_false' }
 * Default: ackmode = 'ack_requeue_true' (PEEK without popping)
 */
app.post('/api/queues/:vhost/:queue/messages', requireBrokerConfig, async (req: Request, res: Response) => {
  const config = (req as any).brokerConfig;
  const vhost = String(req.params.vhost);
  const queue = String(req.params.queue);
  const encodedVhost = encodeVhost(vhost);
  const encodedQueue = encodeURIComponent(queue);

  const count = Math.min(Math.max(parseInt(req.body.count || '10', 10), 1), 100);
  const ackmode = req.body.ackmode === 'ack_requeue_false' ? 'ack_requeue_false' : 'ack_requeue_true';

  const rabbitPayload = {
    count,
    ackmode,
    encoding: 'auto',
    truncate: 500000 // up to 500KB per message payload preview
  };

  const result = await forwardToRabbitMQ(
    config,
    `/queues/${encodedVhost}/${encodedQueue}/get`,
    {
      method: 'POST',
      body: rabbitPayload,
      timeoutMs: 12000
    }
  );

  return res.status(result.status).json(result.data);
});

/**
 * 7. Purge all messages from Queue
 */
app.delete('/api/queues/:vhost/:queue/contents', requireBrokerConfig, async (req: Request, res: Response) => {
  const config = (req as any).brokerConfig;
  const vhost = String(req.params.vhost);
  const queue = String(req.params.queue);
  const encodedVhost = encodeVhost(vhost);
  const encodedQueue = encodeURIComponent(queue);

  const result = await forwardToRabbitMQ(
    config,
    `/queues/${encodedVhost}/${encodedQueue}/contents`,
    { method: 'DELETE', timeoutMs: 10000 }
  );

  if (result.status === 204) {
    return res.json({ success: true, message: `Queue "${queue}" purged successfully.` });
  }

  return res.status(result.status).json(result.data);
});

// Serve frontend build if present
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) {
      // Client dist not yet built
      res.status(404).send('Rabbit Viewer API running. Start or build client frontend.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`[rabbit-viewer-proxy] Server listening on http://localhost:${PORT}`);
});
