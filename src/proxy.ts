import { NextResponse, type NextRequest } from "next/server";
import { lasSession, SESSION_COOKIE } from "@/lib/auth";

const OPPNA = ["/logga-in", "/api/logga-in"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (OPPNA.includes(pathname)) return NextResponse.next();

  if (lasSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ fel: "Inte inloggad" }, { status: 401 });
  }
  const url = new URL("/logga-in", req.url);
  url.searchParams.set("nasta", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
