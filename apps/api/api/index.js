// Vercel entry for the API. It starts the unmodified server (dist/main.js, built by `tsc`) once per function instance on a loopback
// port and forwards each request to it, so the bootstrap in src/main.ts (helmet, CORS, rate limit, prefix) is the one that runs.
import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.env.TWIPAY_LOOPBACK_PORT ?? 4010);
process.env.PORT = String(PORT);
process.env.API_BIND_HOST = '127.0.0.1';

function waitForPort(timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(PORT, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error('API_DID_NOT_START'));
        else setTimeout(attempt, 150);
      });
    };
    attempt();
  });
}

let started;
function start() {
  started ??= import('../dist/main.js').then(() => waitForPort()).catch((error) => { console.error('API_START_FAILED', error instanceof Error ? `${error.name}: ${error.message}` : String(error)); started = undefined; throw error; });
  return started;
}

export default async function handler(req, res) {
  try {
    await start();
  } catch {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end('{"code":"API_STARTING"}');
    return;
  }
  const upstream = http.request({ host: '127.0.0.1', port: PORT, method: req.method, path: req.url, headers: req.headers }, (response) => {
    res.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) { res.statusCode = 502; res.end('{"code":"API_UNAVAILABLE"}'); } else res.end(); });
  req.pipe(upstream);
}
