import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Prisma / bcrypt) — used by middleware for route protection.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn = !!auth?.user;
      const p = nextUrl.pathname;
      const isProtected =
        p.startsWith("/trees") || p.startsWith("/tree") || p === "/";
      if (isProtected) return loggedIn;
      // Bounce logged-in users away from auth pages.
      if ((p === "/login" || p === "/register") && loggedIn) {
        return Response.redirect(new URL("/trees", nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
