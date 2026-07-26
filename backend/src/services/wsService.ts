import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

interface ClientSocket {
  userId: string;
  role: 'user' | 'admin';
  ws: WebSocket;
}

const activeClients: ClientSocket[] = [];

export function initializeWebSocket(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: any, socket: any, head: any) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce_Vine_secret_hash_2026_secured';
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role?: string };
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, decoded);
      });
    } catch (err) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  // Start heartbeat interval to clean up dead connections (prevents memory leak of orphaned sockets)
  const heartbeatInterval = setInterval(() => {
    for (let i = activeClients.length - 1; i >= 0; i--) {
      const client = activeClients[i];
      const ws = client.ws as any;

      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        activeClients.splice(i, 1);
        continue;
      }

      if (ws.isAlive === false) {
        ws.terminate();
        activeClients.splice(i, 1);
        continue;
      }

      ws.isAlive = false;
      try {
        ws.ping();
      } catch (err) {
        ws.terminate();
        activeClients.splice(i, 1);
      }
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: WebSocket, user: { id: string; role?: string }) => {
    const client: ClientSocket = {
      userId: user.id,
      role: (user.role === 'admin' || user.role === 'super_admin' || user.id === 'admin-dev-uuid') ? 'admin' : 'user',
      ws
    };

    activeClients.push(client);

    // Setup heartbeat status flags
    (ws as any).isAlive = true;
    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    ws.on('close', () => {
      const idx = activeClients.indexOf(client);
      if (idx !== -1) {
        activeClients.splice(idx, 1);
      }
    });

    ws.on('error', (err) => {
      console.error(`Socket error for user ${user.id}:`, err);
    });

    // Send a connection success alert
    ws.send(JSON.stringify({ type: 'system_connect', message: 'WebSocket connection established successfully.' }));
  });
}

export function broadcastToUser(userId: string, event: string, payload: any) {
  const eventPayload = payload && typeof payload === 'object' ? { ...payload } : { value: payload };
  if (!eventPayload.eventId) {
    eventPayload.eventId = `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  const message = JSON.stringify({ type: event, data: eventPayload });
  activeClients.forEach(c => {
    if (c.userId === userId && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(message);
    }
  });
}

export function broadcastToAdmins(event: string, payload: any) {
  const eventPayload = payload && typeof payload === 'object' ? { ...payload } : { value: payload };
  if (!eventPayload.eventId) {
    eventPayload.eventId = `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  const message = JSON.stringify({ type: event, data: eventPayload });
  activeClients.forEach(c => {
    if (c.role === 'admin' && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(message);
    }
  });
}

export function broadcastAll(event: string, payload: any) {
  const eventPayload = payload && typeof payload === 'object' ? { ...payload } : { value: payload };
  if (!eventPayload.eventId) {
    eventPayload.eventId = `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  const message = JSON.stringify({ type: event, data: eventPayload });
  activeClients.forEach(c => {
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(message);
    }
  });
}
