import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_MAX_AGE, safeEqual, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: "No password is configured." }, { status: 503 });
  }

  const form = await req.formData();
  const submitted = String(form.get("password") ?? "");
  const from = String(form.get("from") ?? "/");

  if (!safeEqual(submitted, password)) {
    const back = new URL("/login", req.url);
    back.searchParams.set("error", "1");
    if (from !== "/") back.searchParams.set("from", from);
    return NextResponse.redirect(back, { status: 303 });
  }

  // Only ever redirect somewhere inside this app — never to a supplied host.
  const target = new URL(from.startsWith("/") ? from : "/", req.url);
  const res = NextResponse.redirect(target, { status: 303 });
  res.cookies.set(COOKIE_NAME, await sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
