// Fetch timeouts abort the network operation; never race a mutating DB promise.
export const authFetch: typeof fetch = (input, init = {}) => fetch(input, {
  ...init, cache:'no-store',signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(8000)]),
});
export async function boundedAuthRead<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Authentication unavailable")), 12000);
  })]); } finally { if (timer) clearTimeout(timer); }
}
