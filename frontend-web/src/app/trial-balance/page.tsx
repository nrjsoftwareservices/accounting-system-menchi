"use client";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Row = { account_id: number; code: string; name: string; type: string; debit: number; credit: number };
type TBResponse = {
  as_of?: string;
  rows: Row[];
  totals: { total_debit: number; total_credit: number };
  current_page: number;
  per_page: number;
  last_page: number;
  total: number;
};

type Org = { id: number; name: string; default_currency?: string };

const fmt = (n: number) => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function TrialBalancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<{ total_debit: number; total_credit: number }>({ total_debit: 0, total_credit: 0 });
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(false);

  const asOfFormatted = useMemo(() => {
    const d = new Date(asOf);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }, [asOf]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const orgId = localStorage.getItem("org_id");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    // Load organization info (for header)
    fetch(`${API_BASE}/organizations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data) => {
        const list: Org[] = Array.isArray(data?.data) ? data.data : data;
        const found = list.find(o => String(o.id) === String(orgId ?? "")) || null;
        setOrg(found);
      })
      .catch(() => {});
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token") || "";
      const orgId = localStorage.getItem("org_id") || "";
      const baseParams = new URLSearchParams({ as_of: asOf, per_page: String(200), page: "1" });
      const first = await fetch(`${API_BASE}/reports/trial-balance?${baseParams.toString()}`, { headers: { Authorization: `Bearer ${token}`, "X-Org-Id": orgId } });
      if (!first.ok) throw new Error(await first.text());
      const data1: TBResponse = await first.json();
      const pages = data1.last_page || 1;
      const promises: Promise<Response>[] = [];
      for (let p = 2; p <= pages; p++) {
        const params = new URLSearchParams({ as_of: asOf, per_page: String(200), page: String(p) });
        promises.push(fetch(`${API_BASE}/reports/trial-balance?${params.toString()}`, { headers: { Authorization: `Bearer ${token}`, "X-Org-Id": orgId } }));
      }
      const rest = await Promise.all(promises);
      const restData: TBResponse[] = await Promise.all(rest.map(async r => r.ok ? r.json() : Promise.reject(await r.text())));
      const allRows = [data1.rows, ...restData.map(d => d.rows)].flat();
      allRows.sort((a, b) => a.code.localeCompare(b.code));
      setRows(allRows);
      setTotals(data1.totals || { total_debit: 0, total_credit: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [asOf]);

  const exportCsv = async () => {
    const token = localStorage.getItem("token");
    const orgId = localStorage.getItem("org_id") || "";
    const params = new URLSearchParams({ as_of: asOf });
    const res = await fetch(`${API_BASE}/exports/reports/trial-balance?${params.toString()}`, { headers: { Authorization: `Bearer ${token || ""}`, "X-Org-Id": orgId } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `trial_balance_${asOf}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto mt-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="text-xl font-semibold">{org?.name || "Company Name"}</div>
          <div className="text-sm text-muted-foreground">Tax Identification Number: —</div>
          <div className="text-base">Trial Balance</div>
          <div className="text-sm text-muted-foreground">As of {asOfFormatted}</div>
          <div className="text-sm text-muted-foreground">In {org?.default_currency || "Currency"}</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            aria-label="As of"
          />
          <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left border-b p-2 w-[40%]">Account Title</th>
              <th className="text-left border-b p-2 w-[15%]">Account Type</th>
              <th className="text-right border-b p-2 bg-yellow-200/60">Debit</th>
              <th className="text-right border-b p-2 bg-yellow-200/60">Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account_id} className="border-b">
                <td className="p-2">{r.name}</td>
                <td className="p-2 italic text-muted-foreground">{capitalize(r.type)}</td>
                <td className="p-2 text-right bg-yellow-200/60">{r.debit ? fmt(r.debit) : "-"}</td>
                <td className="p-2 text-right bg-yellow-200/60">{r.credit ? fmt(r.credit) : "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="p-2 border-t border-b font-semibold" colSpan={2}>Total</td>
              <td className="p-2 text-right border-t border-b bg-yellow-200/60 font-semibold">{fmt(totals.total_debit)}</td>
              <td className="p-2 text-right border-t border-b bg-yellow-200/60 font-semibold">{fmt(totals.total_credit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
    </div>
  );
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
