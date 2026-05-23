import type { ReactNode } from "react";
import { Web3LayoutShell } from "@/providers/web3-layout-shell";

export default function TokenLayout({ children }: { children: ReactNode }) {
  return <Web3LayoutShell>{children}</Web3LayoutShell>;
}
