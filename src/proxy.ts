import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe middleware — the `authorized` callback in authConfig allows/denies
// and redirects unauthenticated users to /login.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except static assets and the auth API route.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
