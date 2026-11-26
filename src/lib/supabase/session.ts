import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";
import { isWebhookPath } from "../webhook-security";

export async function updateSession(request: NextRequest) {
  // These exact provider endpoints authenticate inside their route handlers.
  if (isWebhookPath(request.nextUrl.pathname)) {
    const webhook = NextResponse.next({ request });
    webhook.headers.set("Cache-Control", "no-store");
    return webhook;
  }
  let response = NextResponse.next({ request });

  try {
    const { url, anonKey } = getSupabaseConfig();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // Keep previous writes if the provider calls setAll more than once.
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          for (const cookie of previousCookies) response.cookies.set(cookie);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const { data, error } = await supabase.auth.getUser();
    if ((error || !data.user) && request.nextUrl.pathname !== "/login") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      const redirect = NextResponse.redirect(loginUrl);
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      response = redirect;
    }
  } catch {
    // Fail closed on unavailable Auth/config, without logging tokens or URLs.
    if (request.nextUrl.pathname !== "/login") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      const redirect = NextResponse.redirect(loginUrl);
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      response = redirect;
    }
  }

  // Never cache responses carrying session cookies or authenticated content.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
