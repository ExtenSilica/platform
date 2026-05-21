import type { MetadataRoute } from "next";
import { fetchPackages } from "@/lib/api";

const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://extensilica.com").replace(
  /\/+$/,
  "",
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: site, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/search`, changeFrequency: "daily", priority: 0.9 },
    { url: `${site}/governance`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/token`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site}/token/documentation`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/contributing`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${site}/requests`, changeFrequency: "daily", priority: 0.7 },
  ];

  let packageRoutes: MetadataRoute.Sitemap = [];
  try {
    const packages = await fetchPackages({ limit: 500, sort: "created", order: "desc" });
    packageRoutes = packages.map((pkg) => ({
      url: `${site}/package/${encodeURIComponent(pkg.slug)}`,
      lastModified: pkg.updatedAt ? new Date(pkg.updatedAt) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // API unavailable at build time — static routes only
  }

  return [...staticRoutes, ...packageRoutes];
}
