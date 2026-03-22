import dotenv from 'dotenv';
import dns from 'dns';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '8.8.4.4']);

function resolveHost(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    resolver.resolve4(hostname, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses[0]);
    });
  });
}

async function main() {
  const rawUrl = process.env.DATABASE_URL!;
  const url = new URL(rawUrl);
  const originalHostname = url.hostname;
  const ip = await resolveHost(originalHostname);
  const endpointId = originalHostname.split('.')[0];
  url.hostname = ip;
  url.searchParams.set('options', `endpoint=${endpointId}`);
  const resolvedUrl = url.toString();
  console.log('Resolved URL built. Connecting...');

  const prisma = new PrismaClient({
    datasources: {
      db: { url: resolvedUrl },
    },
  });

  try {
    await prisma.$connect();
    console.log('✅ Prisma connected successfully!');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query result:', result);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
