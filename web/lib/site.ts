// The site's public address, for absolute links (share buttons, RSS, sitemap).
export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
