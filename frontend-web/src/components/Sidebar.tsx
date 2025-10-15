"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export default function Sidebar({ open = true, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname() || "";
  const isActive = (href: string) => pathname.startsWith(href);

  const taActive = useMemo(() => pathname.startsWith("/t-accounts"), [pathname]);
  const [taOpen, setTaOpen] = useState<boolean>(taActive);

  return (
    <aside
      className={`border-r min-h-[calc(100vh-49px)] p-3 bg-card transition-all duration-200 ${
        open ? 'w-56 opacity-100' : 'w-0 opacity-0 pointer-events-none'
      }`}
    >
      <button onClick={onClose} className="md:hidden mb-2 text-xs text-muted-foreground">Close</button>
      <nav className="flex flex-col gap-1 text-sm">
        <NavItem href="/trial-balance" label="Trial Balance" active={isActive("/trial-balance")} />
        <NavItem href="/clients" label="Clients" active={isActive("/clients")} />
        <NavItem href="/accounts" label="Accounts" active={isActive("/accounts")} />
        <NavItem href="/journals" label="Journals" active={isActive("/journals")} />

        {/* T-Accounts collapsible */}
        <button
          type="button"
          onClick={() => setTaOpen(v => !v)}
          className={`px-2 py-1 rounded-md text-left transition-colors ${
            taActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
          aria-expanded={taOpen}
        >
          {taOpen ? '▾' : '▸'} T-Accounts
        </button>
        {taOpen && (
          <div className="ml-3 flex flex-col gap-1">
            <NavItem href="/t-accounts" label="All" active={pathname === "/t-accounts"} />
            <NavItem href="/t-accounts/sales" label="Sales" active={isActive("/t-accounts/sales")} />
            <NavItem href="/t-accounts/purchases" label="Purchases" active={isActive("/t-accounts/purchases")} />
          </div>
        )}

        <NavItem href="/imports" label="Imports" active={isActive("/imports")} />
        <NavItem href="/tax/percentage" label="Percent Tax(3%)" active={isActive("/tax/percentage")} />
        <NavItem href="/contacts" label="Contacts" active={isActive("/contacts")} />
        <NavItem href="/staff" label="Staff" active={isActive("/staff")} />
      </nav>
    </aside>
  );
}

function NavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-2 py-1 rounded-md transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      {label}
    </Link>
  );
}
