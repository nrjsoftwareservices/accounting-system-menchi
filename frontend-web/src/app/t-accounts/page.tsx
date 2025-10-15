"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthRequired } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";

type Account = { id: number; code: string; name: string; type?: string };
type Journal = { id:number; entry_date:string; reference?:string; lines: any[] };

export default function TAccountsPage() {
  useAuthRequired();
  const pathname = usePathname();
  const mode: 'all'|'sales'|'purchase' = pathname?.endsWith('/t-accounts/sales') ? 'sales' : pathname?.endsWith('/t-accounts/purchases') ? 'purchase' : 'all';
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState<string>(new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0,10));
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const acc = await api('/accounts?per_page=0');
      setAccounts(Array.isArray(acc) ? acc : acc?.data || []);

      // Pull all journal pages (client-side since API has no filters)
      const first = await api('/journals?per_page=100&page=1');
      const pages = Number(first?.last_page || 1);
      let all: Journal[] = Array.isArray(first?.data) ? first.data : first;
      const rest: Journal[] = [];
      for (let p=2; p<=pages; p++) {
        const page = await api(`/journals?per_page=100&page=${p}`);
        rest.push(...(Array.isArray(page?.data) ? page.data : page));
      }
      setJournals([...all, ...rest]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{ load(); }, []);

  const ledger = useMemo(()=>{
    const map = new Map<number, { account: Account; debits: any[]; credits: any[]; totalD:number; totalC:number }>();
    const fromD = from ? new Date(from) : null; const toD = to ? new Date(to) : null;
    for (const j of journals) {
      if (mode !== 'all' && (j as any)?.source && (j as any).source !== (mode === 'sales' ? 'sales' : 'purchase')) continue;
      const d = new Date(j.entry_date);
      if (fromD && d < fromD) continue; if (toD && d > toD) continue;
      for (const l of j.lines || []) {
        const accId = Number(l.account_id);
        if (!map.has(accId)) {
          const acc = accounts.find(a=>a.id===accId) || { id: accId, code: String(accId), name: 'Account' };
          map.set(accId, { account: acc, debits: [], credits: [], totalD:0, totalC:0 });
        }
        const bucket = map.get(accId)!;
        if (Number(l.debit||0) > 0) { bucket.debits.push({ j, l }); bucket.totalD += Number(l.debit); }
        if (Number(l.credit||0) > 0) { bucket.credits.push({ j, l }); bucket.totalC += Number(l.credit); }
      }
    }
    // sort accounts by code
    let arr = Array.from(map.values());
    if (mode === 'sales') {
      arr = arr.filter(x => (x.account.type === 'revenue'));
    } else if (mode === 'purchase') {
      arr = arr.filter(x => (x.account.type === 'expense') || /vat|input/i.test(x.account.name||''));
    }
    return arr.sort((a,b)=> (a.account.code||'').localeCompare(b.account.code||''));
  }, [journals, accounts, from, to, mode]);

  const filtered = ledger.filter(x=>{
    const text = `${x.account.code} ${x.account.name}`.toLowerCase();
    return text.includes(q.toLowerCase());
  });

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">T-Accounts{mode==='all'?'': mode==='sales'?' — Sales':' — Purchases/Expenses'}</h1>
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs block">From</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="text-xs block">To</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs block">Search account</label>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Code or name" className="border rounded px-2 py-1 text-sm w-full" />
        </div>
        <Button variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map(({ account, debits, credits, totalD, totalC }) => (
          <div key={account.id} className="border rounded-lg overflow-hidden">
            <div className="bg-card p-2 font-medium">{account.code} – {account.name}</div>
            <div className="grid grid-cols-2">
              <div className="border-r">
                <div className="p-2 font-medium">Debit</div>
                <table className="w-full text-sm">
                  <tbody>
                    {debits.map((x, idx)=> (
                      <tr key={`d-${account.id}-${idx}`} className="border-t">
                        <td className="p-1 text-xs text-muted-foreground w-24">{x.j.entry_date}</td>
                        <td className="p-1">{x.l.description||x.j.reference||''}</td>
                        <td className="p-1 text-right w-24">{Number(x.l.debit||0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-2 text-right font-semibold border-t">{totalD.toFixed(2)}</div>
              </div>
              <div>
                <div className="p-2 font-medium">Credit</div>
                <table className="w-full text-sm">
                  <tbody>
                    {credits.map((x, idx)=> (
                      <tr key={`c-${account.id}-${idx}`} className="border-t">
                        <td className="p-1 text-xs text-muted-foreground w-24">{x.j.entry_date}</td>
                        <td className="p-1">{x.l.description||x.j.reference||''}</td>
                        <td className="p-1 text-right w-24">{Number(x.l.credit||0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-2 text-right font-semibold border-t">{totalC.toFixed(2)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
