const PROTECTED_PREFIXES = [
  "/create",
  "/messages",
  "/saved",
  "/settings",
  "/orders",
  "/queue",
  "/cart",
  "/pending-collaborations",
  "/seller",
  "/insights",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
