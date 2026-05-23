import type { Metadata } from "next";
import { TokenDocumentationArticle } from "@/components/token/token-documentation-article";
import { TokenDocumentationToolbar } from "@/components/token/token-documentation-toolbar";

const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://extensilica.com").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: { absolute: "XSIL Token Documentation — ExtenSilica" },
  description:
    "XSIL token whitepaper v1.0: tokenomics, governance, contribution criteria, claim process, and legal disclaimers.",
  openGraph: {
    title: "XSIL Token Documentation",
    description:
      "Governance token documentation for the ExtenSilica RISC-V extension registry.",
    url: `${site}/token/documentation`,
    type: "article",
  },
};

export default function TokenDocumentationPage() {
  return (
    <div className="container max-w-4xl px-4 py-10 print:max-w-none print:py-0">
      <TokenDocumentationToolbar />
      <TokenDocumentationArticle />
    </div>
  );
}
