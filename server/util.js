// Extract a presentable client IP. On localhost Node reports "::1" or
// "::ffff:127.0.0.1"; we normalise those to "127.0.0.1" so the exported log
// looks like a real Moodle IP column instead of an IPv6 loopback.
export function clientIp(req) {
  let ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "";
  if (ip === "::1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip || "127.0.0.1";
}
