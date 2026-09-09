import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if ((pathname === "/app" || pathname.startsWith("/app/")) && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return supabaseResponse;
}

export const config = {
  // Include exact /app — `/app/:path*` alone does not match `/app`.
  matcher: ["/app", "/app/:path*", "/auth/callback"],
};
