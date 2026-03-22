// prisma.config.ts - Resolves Neon hostname via Google DNS
// to work around local DNS issues
import "dotenv/config";
import { defineConfig } from "prisma/config";
import dns from "dns";

const resolver = new dns.Resolver();
resolver.setServers(["8.8.8.8", "8.8.4.4"]);

function resolveHost(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    resolver.resolve4(hostname, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses[0]);
    });
  });
}

async function getDatabaseUrl(): Promise<string> {
  const rawUrl = process.env["DATABASE_URL"];
  if (!rawUrl) throw new Error("DATABASE_URL is not set");

  try {
    const url = new URL(rawUrl);
    const originalHostname = url.hostname;
    const ip = await resolveHost(originalHostname);
    
    // Extract endpoint ID from hostname (e.g., "ep-divine-wildflower-a108db7q-pooler")
    const endpointId = originalHostname.split('.')[0];
    
    // Replace hostname with resolved IP
    url.hostname = ip;
    
    // Add Neon endpoint routing via options parameter
    url.searchParams.set('options', `endpoint=${endpointId}`);
    
    console.log(`Resolved Neon host to ${ip}, using endpoint=${endpointId}`);
    return url.toString();
  } catch (e) {
    console.warn("DNS resolution failed, using original URL:", e);
    return rawUrl;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: await getDatabaseUrl(),
  },
});
