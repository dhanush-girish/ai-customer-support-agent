import { Client } from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';
import { URL } from 'url';

dotenv.config();

// Override the default DNS resolver so Node uses Google DNS
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
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is missing in .env');
  }

  // Parse the connection string to extract hostname
  const dbUrl = new URL(connectionString);
  const originalHost = dbUrl.hostname;

  console.log(`Resolving ${originalHost} via Google DNS...`);
  const ip = await resolveHost(originalHost);
  console.log(`✅ Resolved to IP: ${ip}`);

  // Connect using IP but set servername for TLS/SNI (required by Neon)
  const client = new Client({
    host: ip,
    port: parseInt(dbUrl.port) || 5432,
    database: dbUrl.pathname.slice(1),
    user: dbUrl.username,
    password: dbUrl.password,
    ssl: {
      rejectUnauthorized: false,
      servername: originalHost, // SNI is required for Neon routing
    },
  });

  try {
    console.log('Connecting to Neon Database...');
    await client.connect();
    console.log('✅ Connected to Neon Database.');

    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ pgvector extension successfully verified/created.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
