import { createHmac, timingSafeEqual } from "node:crypto";
export const MAX_WEBHOOK_BYTES = 256 * 1024;
export function equalToken(actual: string | null, expected: string): boolean {
  if (!actual || !expected || actual.length > 512 || expected.length > 512) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a,b);
}
export function validSignature(raw: Uint8Array, signature: string | null, secret: string): boolean {
  if (!secret || !signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256",secret).update(raw).digest();
  return timingSafeEqual(expected,Buffer.from(signature.slice(7),"hex"));
}
export async function boundedBody(request: Request): Promise<Uint8Array> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || BigInt(length) > BigInt(MAX_WEBHOOK_BYTES))) throw new RangeError("Body too large");
  const reader = request.body?.getReader(); if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = []; let size=0;
  try { for (;;) { const {done,value}=await reader.read(); if(done)break; size+=value.byteLength;
    if(size>MAX_WEBHOOK_BYTES){await reader.cancel();throw new RangeError("Body too large");} chunks.push(value); }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks,size);
}
export const WEBHOOK_PATHS = ["/api/webhooks/meta-ads","/api/webhooks/instagram","/api/webhooks/whatsapp"] as const;
export function isWebhookPath(path: string) { return WEBHOOK_PATHS.some(value=>value===path); }
