import type { Metadata } from "next";
import { fetchGovernancePublicServer } from "@/lib/governance-server";
import { TokenPageContent } from "@/components/token/token-page-content";

const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://extensilica.com").replace(/\/+$/, "");

const title = "XSIL Token — ExtenSilica Contributor Governance";
const description =
  "XSIL is the ExtenSilica contributor governance token: not sold, earned through verified engineering work, and used in governance.";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  openGraph: {
    title,
    description,
    url: `${site}/token`,
    siteName: "ExtenSilica",
    type: "website",
    images: [{ url: `${site}/logo.png`, width: 512, height: 512, alt: "ExtenSilica" }],
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default async function TokenPage() {
  const governance = await fetchGovernancePublicServer();
  return <TokenPageContent governance={governance} />;
}
