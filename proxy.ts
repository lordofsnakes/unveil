import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/new(.*)",
  "/messages(.*)",
  "/notifications(.*)",
  "/profile(.*)",
  "/api/account(.*)",
  "/api/collection(.*)",
  "/api/loyalty(.*)",
  "/api/messages(.*)",
  "/api/posts(.*)",
  "/api/unlock(.*)",
  "/api/user(.*)",
]);

const isPublicApiRoute = createRouteMatcher([
  "/api/blur(.*)",
  "/api/og(.*)",
  "/api/stripe/webhook(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicApiRoute(req)) return;
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
