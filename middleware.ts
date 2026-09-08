import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, safeEqual, sessionToken } from "@/lib/auth";

/**
 * Everything except Next's own assets, the login screen and the login endpoint
 * sits behind the gate — including the API routes, which serve the same figures
 * as the pages.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/login).*)"],
};

export async function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;

  // Fail closed: an unset password in production means misconfiguration, and
  // serving a client's financials wide open is the one outcome worth refusing.
  // Locally it just stays open so dev has no friction.
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "DASHBOARD_PASSWORD is not set on this deployment, so the dashboard is " +
          "refusing to serve. Set it in the hosting project's environment " +
          "variables and redeploy.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie && safeEqual(cookie, await sessionToken(password))) {
    return NextResponse.next();
  }

  const login = new URL("/login", req.url);
  // Come back to whatever was asked for, filters and all.
  const from = req.nextUrl.pathname + req.nextUrl.search;
  if (from !== "/") login.searchParams.set("from", from);
  return NextResponse.redirect(login);
}
