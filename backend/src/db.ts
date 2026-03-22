import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dns from 'dns';
import pg from 'pg';

const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '8.8.4.4']);

function resolveHost(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    resolver.resolve4(hostname, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses[0]!);
    });
  });
}

let prisma: PrismaClient;

export async function getPrisma(): Promise<PrismaClient> {
  if (prisma) return prisma;

  const rawUrl = process.env['DATABASE_URL'];
  if (!rawUrl) throw new Error('DATABASE_URL is not set');

  try {
    const url = new URL(rawUrl);
    const originalHost = url.hostname;
    const ip = await resolveHost(originalHost);
    console.log(`[DB] Resolved Neon host ${originalHost} → ${ip}`);

    // Create a pg.Pool with IP but proper TLS servername for Neon SNI routing
    const pool = new pg.Pool({
      host: ip,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: {
        rejectUnauthorized: false,
        servername: originalHost, // SNI required for Neon endpoint routing
      },
      max: 10,
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('[DB] Connection pool established successfully.');

    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter } as any);

    console.log('[DB] Prisma client initialized.');
    return prisma;
  } catch (err) {
    console.error('[DB] Failed to initialize:', err);
    throw err;
  }
}
