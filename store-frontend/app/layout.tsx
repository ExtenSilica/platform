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
    default: "ExtenSilica — RISC-V Extension Registry",
    template: "%s — ExtenSilica",
  },
  description:
    "Discover, publish, and run reproducible RISC-V extensions using .xsil packages.",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <Suspense
              fallback={
                <div className="h-14 w-full border-b border-border bg-background" />
              }
            >
              <Navbar />
            </Suspense>
            <div className="flex flex-1 flex-col">{children}</div>
            <Footer />
          </div>
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
