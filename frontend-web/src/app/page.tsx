"use client";

import Link from "next/link";
import { useAuthRequired } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "auditor" | "clerk" | "manager" | "accountant" | "admin";

type DashboardStat = {
  label: string;
  count: number;
  delta?: number;
};

type DashboardActivity = {
  id: string;
  type: string;
  title: string;
  status?: string;
  message?: string;
  occurred_at?: string;
  amount?: number;
};

type DashboardSummary = {
  stats: Record<string, DashboardStat>;
  activity: DashboardActivity[];
  permissions: {
    role: Role;
    role_rank: number;
    modules: Record<string, boolean>;
  };
};

type StatDescriptor = {
  key: string;
  fallbackLabel: string;
  helper: string;
};

type ActionCard = {
  key: string;
  label: string;
  description: string;
  href: string;
  accent: string;
  requiredRole: Role;
};

type ModuleDescriptor = {
  key: string;
  name: string;
  href: string;
  copy: string;
  requiredRole: Role;
};

const roleLabels: Record<Role, string> = {
  auditor: "Auditor",
  clerk: "Clerk",
  manager: "Manager",
  accountant: "Accountant",
  admin: "Administrator",
};

const statOrder: StatDescriptor[] = [
  { key: "active_clients", fallbackLabel: "Active Clients", helper: "Firms you administer" },
  { key: "open_ar_invoices", fallbackLabel: "Open A/R Invoices", helper: "Awaiting post or payment" },
  { key: "open_ap_bills", fallbackLabel: "Open A/P Bills", helper: "Pending approval/payment" },
  { key: "unposted_journals", fallbackLabel: "Unposted Journals", helper: "Draft entries requiring review" },
];

const actionCards: ActionCard[] = [
  {
    key: "add_client",
    label: "Add Client",
    description: "Spin up a new organization and invite collaborators.",
    href: "/organizations",
    accent: "from-blue-500 to-indigo-500",
    requiredRole: "admin",
  },
  {
    key: "post_journal",
    label: "Post Journal",
    description: "Lock in manual entries once debits = credits.",
    href: "/journals",
    accent: "from-emerald-500 to-teal-500",
    requiredRole: "accountant",
  },
  {
    key: "create_invoice",
    label: "Create Invoice",
    description: "Draft A/R invoices with tax, FX, and approvals.",
    href: "/ar/invoices",
    accent: "from-amber-500 to-orange-500",
    requiredRole: "accountant",
  },
  {
    key: "create_bill",
    label: "Create Bill",
    description: "Capture vendor bills and stage for payment.",
    href: "/ap/bills",
    accent: "from-rose-500 to-pink-500",
    requiredRole: "accountant",
  },
  {
    key: "imports",
    label: "Import Data",
    description: "Bulk-load accounts or historical journals from CSV.",
    href: "/imports",
    accent: "from-slate-500 to-slate-700",
    requiredRole: "accountant",
  },
];

const moduleGroups: Array<{
  title: string;
  description: string;
  modules: ModuleDescriptor[];
}> = [
  {
    title: "Company Setup",
    description: "Configure organizations, ledger structure, and bulk data onboarding.",
    modules: [
      { key: "organizations", name: "Organizations", href: "/organizations", copy: "Manage client profiles, currency, and branding details.", requiredRole: "clerk" },
      { key: "accounts", name: "Chart of Accounts", href: "/accounts", copy: "Design the ledger tree and control account attributes.", requiredRole: "clerk" },
      { key: "imports", name: "Imports", href: "/imports", copy: "Bulk upload accounts and historical journals from CSV.", requiredRole: "accountant" },
    ],
  },
  {
    title: "Order to Cash (A/R)",
    description: "Stay on top of customers, invoices, and collections.",
    modules: [
      { key: "customers", name: "Customers", href: "/customers", copy: "Maintain customer master data, contacts, and roles.", requiredRole: "clerk" },
      { key: "ar_invoices", name: "A/R Invoices", href: "/ar/invoices", copy: "Draft, approve, and post invoices with line-level taxes.", requiredRole: "manager" },
      { key: "contacts", name: "Contacts", href: "/contacts", copy: "Track communications and watchers per document.", requiredRole: "manager" },
    ],
  },
  {
    title: "Procure to Pay (A/P)",
    description: "Control vendor onboarding, bills, and payment approvals.",
    modules: [
      { key: "suppliers", name: "Suppliers", href: "/suppliers", copy: "Capture vendor banking info, currency, and tax IDs.", requiredRole: "clerk" },
      { key: "ap_bills", name: "A/P Bills", href: "/ap/bills", copy: "Create drafts, route for approval, and post to the ledger.", requiredRole: "manager" },
      { key: "tax", name: "Tax & Withholding", href: "/tax", copy: "Configure VAT/GST rules and withholding certificates.", requiredRole: "manager" },
    ],
  },
  {
    title: "Ledger & Reporting",
    description: "Ensure books stay balanced and audit-ready.",
    modules: [
      { key: "journals", name: "Journals", href: "/journals", copy: "Review manual entries, approvals, and posting status.", requiredRole: "manager" },
      { key: "trial_balance", name: "Trial Balance", href: "/trial-balance", copy: "Get a real-time view of account balances by period.", requiredRole: "manager" },
      { key: "t_accounts", name: "T-Accounts", href: "/t-accounts", copy: "Drill into ledger activity for reconciliation and audits.", requiredRole: "manager" },
    ],
  },
  {
    title: "People & Permissions",
    description: "Limit access with org roles mapped to accounting duties.",
    modules: [
      { key: "staff", name: "Staff", href: "/staff", copy: "Invite teammates, assign org roles, and revoke access.", requiredRole: "admin" },
      { key: "clients", name: "Clients", href: "/clients", copy: "Switch context across the firms you administer.", requiredRole: "clerk" },
    ],
  },
];

function formatDelta(value?: number) {
  if (value === undefined || value === null) return "Awaiting data";
  if (value === 0) return "No change this week";
  const suffix = Math.abs(value) === 1 ? "item this week" : "items this week";
  return `${value > 0 ? "+" : ""}${value} ${suffix}`;
}

function formatTimestamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
}

export default function Home() {
  useAuthRequired();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentOrg, setCurrentOrg] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/dashboard/summary");
      setSummary(data);
    } catch (err: any) {
      setSummary(null);
      setError(err?.message || "Unable to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentOrg(localStorage.getItem("org_id"));
    }
    loadSummary();
  }, [loadSummary]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);
  const userRoleLabel = summary ? roleLabels[summary.permissions.role] : "—";

  const activityItems = summary?.activity ?? [];

  const canAccess = useCallback(
    (key: string, fallback = true) => {
      if (!summary) return fallback;
      return Boolean(summary.permissions.modules[key]);
    },
    [summary]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="space-y-4 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-900 p-8 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-widest text-white/70">Accounting Workspace</p>
            <button
              type="button"
              onClick={loadSummary}
              className="text-xs font-medium uppercase tracking-wide text-white/70 transition hover:text-white"
            >
              Refresh ↻
            </button>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold lg:text-4xl">Command Center</h1>
              <p className="mt-2 max-w-3xl text-base text-white/80">
                Monitor ledgers, receivables, payables, and compliance in one place. Dive into any module in a single click and keep every client&apos;s books current.
              </p>
              <p className="mt-3 text-sm text-white/70">
                Current client ID: <span className="font-semibold text-white">{currentOrg ?? "not selected"}</span> · Role:{" "}
                <span className="font-semibold text-white">{userRoleLabel}</span>
              </p>
            </div>
            <Link
              href="/organizations"
              className="inline-flex items-center rounded-full bg-white/15 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/25"
            >
              Switch Client Context →
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <p className="font-semibold">Dashboard unavailable</p>
            <p className="mt-1">{error}</p>
            {error.toLowerCase().includes("organization") ? (
              <p className="mt-2">
                Pick an organization on the <Link href="/clients" className="font-semibold underline">Clients</Link> page, then refresh.
              </p>
            ) : (
              <button type="button" onClick={loadSummary} className="mt-2 font-semibold underline">
                Try again
              </button>
            )}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statOrder.map((descriptor) => {
            const stat = summary?.stats?.[descriptor.key];
            const value = stat ? numberFormatter.format(stat.count) : "—";
            const changeLabel = formatDelta(stat?.delta);
            const changeClass = stat && stat.delta && stat.delta > 0 ? "text-emerald-600" : "text-slate-500";
            return (
              <div key={descriptor.key} className="rounded-2xl border border-white/60 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">{stat?.label ?? descriptor.fallbackLabel}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{loading ? <span className="animate-pulse text-slate-300">•••</span> : value}</p>
                <p className={`mt-2 text-xs ${changeClass}`}>{loading ? "Syncing..." : changeLabel}</p>
                <p className="mt-1 text-xs text-slate-400">{descriptor.helper}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actionCards.map((action) => {
            const allowed = canAccess(action.key);
            const cardContent = (
              <div className="flex h-full flex-col rounded-2xl bg-white p-4">
                <span className="text-xs uppercase tracking-wide text-slate-500">Quick Action</span>
                <span className="mt-3 text-lg font-semibold text-slate-900">{action.label}</span>
                <span className="mt-2 text-sm text-slate-500">{action.description}</span>
                {allowed ? (
                  <span className="mt-auto text-sm font-medium text-indigo-600">Open Module →</span>
                ) : (
                  <span className="mt-auto text-xs font-semibold text-rose-600">
                    Requires {roleLabels[action.requiredRole]}
                  </span>
                )}
              </div>
            );
            return allowed ? (
              <Link
                key={action.key}
                href={action.href}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${action.accent} p-[1px] shadow-lg`}
              >
                {cardContent}
              </Link>
            ) : (
              <div
                key={action.key}
                className={`relative rounded-2xl bg-gradient-to-br ${action.accent} p-[1px] shadow-lg opacity-60`}
                aria-disabled
              >
                {cardContent}
              </div>
            );
          })}
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Activity Feed</p>
            {loading ? (
              <div className="mt-3 space-y-3">
                {[...Array(3)].map((_, idx) => (
                  <div key={idx} className="h-12 w-full animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : activityItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No activity recorded for this client yet.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm text-slate-600">
                {activityItems.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="uppercase">{item.type}</span>
                      <span>{formatTimestamp(item.occurred_at)}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.message}</p>
                    {item.status && (
                      <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-600">
                        {item.status}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-8">
          {moduleGroups.map((group) => (
            <div key={group.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{group.title}</h2>
                  <p className="text-sm text-slate-500">{group.description}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {group.modules.map((module) => {
                  const allowed = canAccess(module.key);
                  const baseClasses =
                    "rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition";
                  const content = (
                    <>
                      <p className="text-sm uppercase tracking-wide text-slate-500">{module.href}</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{module.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{module.copy}</p>
                      {!allowed && (
                        <p className="mt-3 text-xs font-semibold text-rose-600">
                          Requires {roleLabels[module.requiredRole]}
                        </p>
                      )}
                    </>
                  );
                  return allowed ? (
                    <Link key={module.key} href={module.href} className={`${baseClasses} hover:border-indigo-200 hover:bg-white`}>
                      {content}
                    </Link>
                  ) : (
                    <div key={module.key} className={`${baseClasses} opacity-60`} aria-disabled>
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
