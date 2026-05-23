"use client";

import type { ReactNode } from "react";
import { Web3Provider } from "@/providers/Web3Provider";

/** Wrap routes that use RainbowKit / wagmi (keeps root layout chunk small). */
export function Web3LayoutShell({ children }: { children: ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>;
}
