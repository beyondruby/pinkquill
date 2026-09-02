const PROTECTED_PREFIXES = [
  "/create",
  "/messages",
  "/saved",
  "/settings",
  "/orders",
  "/checkout",
  "/cart",
  "/pending-collaborations",
  "/seller",
  "/sell",
  "/insights",
  "/community/create",
  "/takes/create",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
