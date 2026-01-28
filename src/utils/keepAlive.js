import http from 'http';
import logger from './logger.js';

let server = null;
let keepAliveInterval = null;

const PORT = process.env.KEEPALIVE_PORT || 3001;

export function startKeepAlive() {
  if (server) return;

  server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!');
  });

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Keep-alive server running on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${PORT} already in use, keep-alive server not started`);
    }
  });

  keepAliveInterval = setInterval(() => {
    try {
      const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
        res.resume();
      });
      req.on('error', () => {});
      req.end();
    } catch (e) {}
  }, 4 * 60 * 1000);
}

export function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  if (server) {
    server.close();
    server = null;
  }
}

export default { startKeepAlive, stopKeepAlive };
