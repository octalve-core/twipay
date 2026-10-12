#!/usr/bin/env node
/** Refuse an occupied local test port; never terminate another process. */
import net from 'node:net';

export async function assertPortsFree(portValues) {
  const ports = portValues.map(Number);
  if (ports.length === 0 || ports.some(port => !Number.isInteger(port) || port < 1024 || port > 65535) || new Set(ports).size !== ports.length) {
    throw new Error('INVALID_QUALIFICATION_PORTS');
  }
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', () => reject(new Error(`QUALIFICATION_PORT_OCCUPIED:${port}`)));
      server.listen(port, '127.0.0.1', () => server.close(resolve));
    });
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try { await assertPortsFree(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
