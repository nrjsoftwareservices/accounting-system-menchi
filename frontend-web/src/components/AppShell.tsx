"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Nav from "@/components/Nav";
import Sidebar from "@/components/Sidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import RoleBadge from "@/components/RoleBadge";
import OrgSwitcher from "@/components/OrgSwitcher";
import LogoutButton from "@/components/LogoutButton";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname === "/login";
  // Hooks must not be conditional; declare consistently
  const [sidebarOpen, setSidebarOpen] = useState(true);
  if (isAuth) {
    // Minimal layout on auth routes; hooks order remains stable
    return <>{children}</>;
  }
  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              aria-label="Toggle sidebar"
              onClick={() => setSidebarOpen((v) => !v)}
              className="px-2 py-1 border rounded-md text-sm hover:bg-accent hover:text-accent-foreground"
            >
              ☰
            </button>
            <div className="font-semibold">Accounting System</div>
          </div>
          <Nav />
          <div className="flex items-center gap-2">
            <RoleBadge />
            <OrgSwitcher />
            <LogoutButton />
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto flex flex-1 w-full">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-4">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
