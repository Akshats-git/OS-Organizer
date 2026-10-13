import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  if (await verifySession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  // Server actions are POSTs to the page; a redirect would confuse the client, so refuse plainly.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("Sign in first.", { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // API routes check INGEST_SECRET themselves (bot, Gmail script, calendar feed).
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webmanifest|txt)$).*)"],
};
