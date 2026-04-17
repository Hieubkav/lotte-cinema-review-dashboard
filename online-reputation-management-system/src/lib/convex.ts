import { ConvexHttpClient } from "convex/browser";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  process.env.CONVEX_URL ||
  "";

if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL (or CONVEX_URL) for Convex client");
}

const client = new ConvexHttpClient(convexUrl);

export function getConvexClient() {
  return client;
}

export async function convexQuery<T = any>(functionPath: string, args: Record<string, any> = {}): Promise<T> {
  return (await client.query(functionPath as any, args as any)) as T;
}

export async function convexMutation<T = any>(functionPath: string, args: Record<string, any> = {}): Promise<T> {
  return (await client.mutation(functionPath as any, args as any)) as T;
}

export async function convexAction<T = any>(functionPath: string, args: Record<string, any> = {}): Promise<T> {
  return (await client.action(functionPath as any, args as any)) as T;
}
