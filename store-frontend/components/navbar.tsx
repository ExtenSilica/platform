"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, LayoutDashboard, LogOut, User, Plus, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

export function Navbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user, logout, isLoading } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSearchPage = pathname === "/search";
  const currentQuery = isSearchPage ? (searchParams.get("q") ?? "") : "";

  function handleSearch(term: string) {
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    router.replace(`/search?${params.toString()}`);
  }

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.push("/");
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <img src="/logo.svg" alt="" className="h-7 w-7" />
          <span className="text-lg font-bold">ExtenSilica</span>
        </Link>

        <div className="relative min-w-0 flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search packages…"
            className="h-9 w-full pl-9 text-sm"
            onChange={(e) => handleSearch(e.target.value)}
            defaultValue={currentQuery}
          />
        </div>

        <div className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
          <Link href="/search" className="hover:text-foreground transition-colors">
            Browse
          </Link>
          <Link href="/faq" className="hover:text-foreground transition-colors">
            FAQ
          </Link>
        </div>

        {/* Auth area */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {isLoading ? (
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <>
              <Link
                href="/publish/new"
                className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-md border bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Publish
              </Link>

              {/* User menu */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted transition-colors"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold uppercase text-primary-foreground">
                    {user.username.charAt(0)}
                  </div>
                  <span className="hidden sm:block">{user.username}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 rounded-lg border bg-popover shadow-md z-50">
                    <div className="px-3 py-2 border-b">
                      <p className="text-xs font-medium">{user.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/dashboard"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                        Dashboard
                      </Link>
                      <Link
                        href={`/users/${user.username}`}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        Public profile
                      </Link>
                      <Link
                        href="/publish/new"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors sm:hidden"
                      >
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        Publish package
                      </Link>
                    </div>
                    <div className="border-t py-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="h-8 inline-flex items-center rounded-md px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="h-8 inline-flex items-center rounded-md border bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
