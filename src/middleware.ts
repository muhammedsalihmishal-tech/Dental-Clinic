import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    // Forward pathname so root layout can conditionally hide the sidebar
    const res = NextResponse.next({
      request: { headers: new Headers({ ...Object.fromEntries(req.headers), "x-invoke-path": req.nextUrl.pathname }) },
    });
    // Admin-only routes
    if (req.nextUrl.pathname.startsWith("/settings") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return res;
  },
  {
    callbacks: {
      authorized({ token, req }) {
        // Public routes skip auth
        if (req.nextUrl.pathname.startsWith("/book")) return true;
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: [
    "/((?!api/auth|api/voice|api/cron|api/webhooks|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
