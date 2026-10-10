import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    // Admin-only routes
    if (req.nextUrl.pathname.startsWith("/settings") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token }) {
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
