import { VerifyEmailClient } from "./verify-email-client";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: { token?: string | string[] };
};

function readToken(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === "string" ? v.trim() : "";
}

export default function VerifyEmailPage({ searchParams }: PageProps) {
  return <VerifyEmailClient token={readToken(searchParams.token)} />;
}
