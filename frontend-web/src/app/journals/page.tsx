"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthRequired } from "@/lib/useAuth";

type Account = { id: number; code: string; name: string };
type Line = { account_id?: number; description?: string; debit?: number; credit?: number };

export default function JournalsPage() {
  useAuthRequired();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string,string[]>>({});
  const [form, setForm] = useState<{ entry_date?: string; reference?: string; lines: Line[] }>({ lines: [{},{}] });

  const totals = useMemo(() => {
    const td = form.lines.reduce((s,l)=> s + Number(l.debit||0), 0);
    const tc = form.lines.reduce((s,l)=> s + Number(l.credit||0), 0);
    return { debit: round2(td), credit: round2(tc), balanced: round2(td) === round2(tc) && td>0 };
  }, [form.lines]);

  const load = () => {
    Promise.all([
      api(`/accounts?per_page=0`),
      api(`/journals?per_page=${perPage}&page=${page}`),
    ]).then(([acc, journals]) => {
      setAccounts(Array.isArray(acc) ? acc : acc?.data || []);
      if (Array.isArray(journals?.data)) {
        setList(journals.data);
        setPage(journals.current_page || 1);
        setLastPage(journals.last_page || 1);
        setTotal(journals.total || journals.data.length);
      } else {
        setList(journals);
        setLastPage(1); setTotal(journals.length || 0);
      }
    }).catch((e:any)=> setError(e?.message || String(e)));
  };
  useEffect(()=>{ load(); }, [page, perPage]);

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setForm(prev => {
      const lines = [...prev.lines];
      const next = { ...lines[idx], ...patch } as Line;
      next.debit = Number(next.debit ?? 0); next.credit = Number(next.credit ?? 0);
      if (patch.debit !== undefined) next.credit = 0;
      if (patch.credit !== undefined) next.debit = 0;
      lines[idx] = next;
      return { ...prev, lines };
    });
  };

  const addLine = () => setForm(prev => ({...prev, lines: [...prev.lines, {}]}));
  const removeLine = (i:number) => setForm(prev => ({...prev, lines: prev.lines.filter((_,idx)=>idx!==i)}));

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!totals.balanced) { setError('Debits and credits must balance and be > 0'); return; }
    try {
      await api('/journals', { method:'POST', body: JSON.stringify(form) });
      setForm({ lines: [{},{}] });
      setFormErrors({});
      load();
    } catch (err:any) {
      setError(err.message || 'Failed'); setFormErrors(err.errors||{});
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-semibold">Journal Entries</h1>

      <section className="border rounded-lg p-3">
        <h2 className="font-medium mb-3">New Entry</h2>
        <form onSubmit={create} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="entry_date">Date</Label>
              <Input id="entry_date" type="date" required value={form.entry_date||''} onChange={e=>setForm({...form, entry_date: e.target.value})} />
            </div>
            <div className="flex-1">
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" value={form.reference||''} onChange={e=>setForm({...form, reference: e.target.value})} placeholder="Optional" />
            </div>
          </div>
          <div>
            <table className="w-full border text-sm">
              <thead><tr className="bg-gray-50"><th className="p-1 border">Account</th><th className="p-1 border">Description</th><th className="p-1 border text-right">Debit</th><th className="p-1 border text-right">Credit</th><th className="p-1 border"></th></tr></thead>
              <tbody>
                {form.lines.map((ln, i) => (
                  <tr key={i}>
                    <td className="border p-1">
                      <select value={ln.account_id||''} onChange={e=>updateLine(i,{ account_id: Number(e.target.value) })} className="border rounded w-full px-1 py-1">
                        <option value="">Select account</option>
                        {accounts.map(a=> <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                      </select>
                    </td>
                    <td className="border p-1">
                      <input value={ln.description||''} onChange={e=>updateLine(i,{ description: e.target.value })} className="border rounded w-full px-1 py-1" />
                    </td>
                    <td className="border p-1 text-right">
                      <input type="number" step="0.01" value={ln.debit||''} onChange={e=>updateLine(i,{ debit: Number(e.target.value) })} className="border rounded w-full px-1 py-1 text-right" />
                    </td>
                    <td className="border p-1 text-right">
                      <input type="number" step="0.01" value={ln.credit||''} onChange={e=>updateLine(i,{ credit: Number(e.target.value) })} className="border rounded w-full px-1 py-1 text-right" />
                    </td>
                    <td className="border p-1 text-right">
                      <button type="button" onClick={()=>removeLine(i)} className="text-xs text-red-700">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between mt-2 text-sm">
              <button type="button" onClick={addLine} className="text-teal-700">+ Add line</button>
              <div>
                <span className="mr-4">Debit: <span className="font-medium">{totals.debit.toFixed(2)}</span></span>
                <span>Credit: <span className="font-medium">{totals.credit.toFixed(2)}</span></span>
              </div>
            </div>
            {!totals.balanced && (
              <div className="text-xs text-red-600">Debits and credits must balance.</div>
            )}
          </div>
          {error && <div className="text-sm text-red-700">{error}</div>}
          <Button type="submit" disabled={!totals.balanced}>Create Entry</Button>
        </form>
      </section>

      <section className="border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">Recent Entries</h2>
          <div className="text-sm">Total: {total}</div>
        </div>
        <table className="w-full border text-sm">
          <thead><tr className="bg-gray-50"><th className="p-2 border">Date</th><th className="p-2 border">Reference</th><th className="p-2 border">Lines</th><th className="p-2 border text-right">Debit</th><th className="p-2 border text-right">Credit</th></tr></thead>
          <tbody>
            {list.map((j:any)=>{
              const dsum = (j.lines||[]).reduce((s:any,l:any)=>s+Number(l.debit||0),0);
              const csum = (j.lines||[]).reduce((s:any,l:any)=>s+Number(l.credit||0),0);
              return (
                <tr key={j.id}>
                  <td className="p-2 border">{j.entry_date}</td>
                  <td className="p-2 border">{j.reference||''}</td>
                  <td className="p-2 border">{(j.lines||[]).length}</td>
                  <td className="p-2 border text-right">{dsum.toFixed(2)}</td>
                  <td className="p-2 border text-right">{csum.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
      </section>
    </div>
  );
}

function Pagination({ page, lastPage, total, onChange }: { page: number; lastPage: number; total: number; onChange: (p:number)=>void }) {
  const pages: number[] = [];
  const start = Math.max(1, page-2); const end = Math.min(lastPage, page+2);
  for (let p=start; p<=end; p++) pages.push(p);
  return (
    <div className="flex items-center justify-between mt-2 text-sm">
      <div>Total: {total}</div>
      <div className="flex items-center gap-1">
        <button disabled={page<=1} onClick={()=>onChange(page-1)} className={`px-2 py-1 border rounded ${page<=1?'opacity-50':''}`}>Prev</button>
        {pages.map(p=> <button key={p} onClick={()=>onChange(p)} className={`px-2 py-1 border rounded ${p===page?'bg-primary text-primary-foreground':''}`}>{p}</button>)}
        <button disabled={page>=lastPage} onClick={()=>onChange(page+1)} className={`px-2 py-1 border rounded ${page>=lastPage?'opacity-50':''}`}>Next</button>
      </div>
    </div>
  );
}

function round2(n: number) { return Math.round((Number(n)||0) * 100) / 100; }

