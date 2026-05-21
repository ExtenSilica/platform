import { getRegistryOrigin } from "@/lib/api";
import type { GovernancePublic } from "@/lib/api";

export async function fetchGovernancePublicServer(): Promise<GovernancePublic | null> {
  try {
    const res = await fetch(`${getRegistryOrigin()}/governance`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as GovernancePublic;
  } catch {
    return null;
  }
}
