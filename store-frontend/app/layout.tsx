import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ExtenSilica — Port RISC-V extensions across cores",
    template: "%s — ExtenSilica",
  },
  description:
    "Describe a RISC-V extension once, check core compatibility, generate adapters, and prove ports with shared differential tests. The registry remembers what was validated.",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="[scrollbar-gutter:stable]">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <div className="print:hidden">
              <Suspense
                fallback={
                  <div className="h-14 w-full border-b border-border bg-background" />
                }
              >
                <Navbar />
              </Suspense>
            </div>
            <div className="flex flex-1 flex-col">{children}</div>
            <div className="print:hidden">
              <Footer />
            </div>
          </div>
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
