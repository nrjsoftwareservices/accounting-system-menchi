"use client";
import { useEffect, useMemo, useState, Fragment, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api";

type MonthKey = 0|1|2|3|4|5|6|7|8|9|10|11;
const MONTHS = [
  "Jan","Feb","Mar",
  "Apr","May","Jun",
  "Jul","Aug","Sep",
  "Oct","Nov","Dec",
] as const;

function qLabel(q: number, year: number) {
  const ord = ["1st","2nd","3rd","4th"][q] || `${q+1}th`;
  return `${ord} Qtr of ${year}`;
}
const fmt = (n: number) => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);

type Data = {
  gross: number[];        // 12
  ratePct: number[];      // 12 (defaults 3)
  credit2307: number[];   // 12
  prevQtrPaid: number[];  // 12
};

const ZEROES = () => Array.from({length:12}, ()=>0);

export default function PercentageTaxPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<Data>({
    gross: ZEROES(),
    ratePct: Array.from({length:12}, ()=>3),
    credit2307: ZEROES(),
    prevQtrPaid: ZEROES(),
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const storageKey = useMemo(()=>{
    const org = typeof window!=="undefined" ? localStorage.getItem("org_id") || "_" : "_";
    return `pct_tax_${year}_${org}`;
  }, [year]);

  useEffect(()=>{
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setData(parsed as Data);
      }
    } catch {}
  }, [storageKey]);

  useEffect(()=>{ try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch {} }, [data, storageKey]);

  // Mark as dirty when user edits values other than gross (gross is computed server-side but editable locally)
  useEffect(() => { setDirty(true); }, [
    // Exclude gross to avoid toggling dirty when backend recomputes
    data.ratePct.join(','), data.credit2307.join(','), data.prevQtrPaid.join(',')
  ]);

  const loadFromBackend = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("token") || "";
      const orgId = localStorage.getItem("org_id") || "";
      if (!token || !orgId) throw new Error("Not authenticated or organization not selected");
      const res = await fetch(`${API_BASE}/tax/percentage?year=${year}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Org-Id': orgId }
      });
      if (!res.ok) throw new Error(await res.text());
      const resp = await res.json();
      const pad12 = (arr: any[], fill = 0) => Array.from({length:12}, (_,i)=> Number.isFinite(Number(arr?.[i])) ? Number(arr[i]) : fill);
      setData({
        gross: pad12(resp?.gross, 0),
        ratePct: pad12(resp?.ratePct, 3),
        credit2307: pad12(resp?.credit2307, 0),
        prevQtrPaid: pad12(resp?.prevQtrPaid, 0),
      });
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { loadFromBackend(); }, [loadFromBackend]);

  const saveToBackend = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      const token = localStorage.getItem("token") || "";
      const orgId = localStorage.getItem("org_id") || "";
      if (!token || !orgId) throw new Error("Not authenticated or organization not selected");
      const res = await fetch(`${API_BASE}/tax/percentage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Org-Id': orgId },
        body: JSON.stringify({ year, ratePct: data.ratePct, credit2307: data.credit2307, prevQtrPaid: data.prevQtrPaid })
      });
      if (!res.ok) throw new Error(await res.text());
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [year, data.ratePct, data.credit2307, data.prevQtrPaid]);

  const due = useMemo(()=> data.gross.map((g,i)=> round2(g * (Number(data.ratePct[i]||0) / 100))), [data]);
  const credit = useMemo(()=> data.credit2307.map((c,i)=> round2(c + (data.prevQtrPaid[i]||0))), [data]);
  const payable = useMemo(()=> due.map((d,i)=> round2(Math.max(d - (credit[i]||0), 0))), [due, credit]);

  const qTotals = (arr: number[]) => [0,1,2,3].map(q=> round2(sum(arr.slice(q*3, q*3+3))));
  const totals = {
    gross: qTotals(data.gross),
    due: qTotals(due),
    credit2307: qTotals(data.credit2307),
    prevQtrPaid: qTotals(data.prevQtrPaid),
    credit: qTotals(credit),
    payable: qTotals(payable),
  };

  const reset = () => setData({ gross: ZEROES(), ratePct: Array(12).fill(3), credit2307: ZEROES(), prevQtrPaid: ZEROES() });

  return (
    <div className="max-w-[1200px] mx-auto mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h1 className="text-lg font-semibold">Percentage Tax Computation</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm">Year</label>
          <input type="number" value={year} onChange={e=>setYear(Number(e.target.value||new Date().getFullYear()))} className="border rounded px-2 py-1 w-24 text-sm" />
          <Button variant="outline" onClick={loadFromBackend} disabled={loading}>Reload</Button>
          <Button variant="default" onClick={saveToBackend} disabled={saving || loading || !dirty}>{saving ? 'Saving…' : (dirty ? 'Save' : 'Saved')}</Button>
          <Button variant="outline" onClick={reset}>Reset</Button>
          <Button variant="outline" onClick={()=>window.print()}>Print</Button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive mb-2">{error}</p>}
      {loading && <p className="text-xs text-muted-foreground mb-2">Loading…</p>}

      <div className="overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="align-bottom border p-2 w-[180px] bg-blue-100">Particular</th>
              {[0,1,2,3].map(q=> (
                <th key={q} className="text-center border p-2 bg-blue-200" colSpan={4}>{qLabel(q, year)}</th>
              ))}
            </tr>
            <tr>
              <th className="border p-2 bg-blue-100" />
              {[0,1,2,3].map(q=> (
                <Fragment key={`q-${q}`}>
                  <th className="border p-2">{MONTHS[q*3+0]}</th>
                  <th className="border p-2">{MONTHS[q*3+1]}</th>
                  <th className="border p-2">{MONTHS[q*3+2]}</th>
                  <th className="border p-2">Total</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Gross */}
            <RowLabel label="Gross Sales / Receipt" labelClass="bg-blue-50 font-medium" />
            <RowEditableNumbers values={data.gross} onChange={(i,v)=> setData(d=> ({...d, gross: patch(d.gross, i, v)}))} quarterTotals={totals.gross} />

            {/* Rate */}
            <RowLabel label="PT10 - Person Exempt from VAT" />
            <RowEditableRates values={data.ratePct} onChange={(i,v)=> setData(d=> ({...d, ratePct: patchNum(d.ratePct, i, v)}))} />

            {/* Tax Due */}
            <RowLabel label="Total Tax Due" />
            <RowComputed values={due} quarterTotals={totals.due} highlightLeft />

            {/* Less */}
            <tr><td className="border p-2 font-medium" colSpan={17}>Less :</td></tr>
            <RowLabel label="Creditable Percentage BIR 2307" indent />
            <RowEditableNumbers values={data.credit2307} onChange={(i,v)=> setData(d=> ({...d, credit2307: patch(d.credit2307, i, v)}))} quarterTotals={totals.credit2307} />
            <RowLabel label="Tax Paid in Prev Qtr" indent />
            <RowEditableNumbers values={data.prevQtrPaid} onChange={(i,v)=> setData(d=> ({...d, prevQtrPaid: patch(d.prevQtrPaid, i, v)}))} quarterTotals={totals.prevQtrPaid} />

            <RowLabel label="Total Tax Credit" />
            <RowComputed values={credit} quarterTotals={totals.credit} />

            <RowLabel label="Total Amount Payable" labelClass="bg-blue-100 font-semibold" />
            <RowComputed values={payable} quarterTotals={totals.payable} strong />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowLabel({ label, indent, labelClass }: { label: string; indent?: boolean; labelClass?: string }) {
  return (
    <tr>
      <td className={`border p-2 ${labelClass??""}`}>{indent ? <span className="pl-6 inline-block">{label}</span> : label}</td>
      {Array.from({length:16}).map((_,i)=> (
        <td key={i} className="border p-2" />
      ))}
    </tr>
  );
}

function RowEditableNumbers({ values, onChange, quarterTotals }: { values: number[]; onChange: (i:number, v:number)=>void; quarterTotals: number[] }) {
  return (
    <tr>
      <td className="border p-0" />
      {values.map((val, i) => (
        <td key={i} className="border p-0">
          <input
            type="number"
            className="w-full px-2 py-1 text-right outline-none"
            value={formatInput(val)}
            onChange={(e)=> onChange(i, parseFloat(e.target.value || '0'))}
          />
        </td>
      ))}
      {[0,1,2,3].map(q=> (
        <td key={`qt-${q}`} className="border p-2 text-right font-medium">{fmt(quarterTotals[q]||0)}</td>
      ))}
    </tr>
  );
}

function RowEditableRates({ values, onChange }: { values: number[]; onChange: (i:number, v:number)=>void }) {
  return (
    <tr>
      <td className="border p-0" />
      {values.map((val, i) => (
        <td key={i} className="border p-0">
          <div className="flex items-center">
            <input
              type="number"
              className="w-full px-2 py-1 text-right outline-none"
              value={formatInput(val)}
              onChange={(e)=> onChange(i, parseFloat(e.target.value || '0'))}
            />
            <span className="px-2">%</span>
          </div>
        </td>
      ))}
      {[0,1,2,3].map(q=> (
        <td key={`rt${q}`} className="border p-2 text-center">{formatInput(values[q*3] ?? 0)}%</td>
      ))}
    </tr>
  );
}

function RowComputed({ values, quarterTotals, strong, highlightLeft }: { values: number[]; quarterTotals: number[]; strong?: boolean; highlightLeft?: boolean }) {
  const cellClass = `border p-2 text-right ${highlightLeft? 'bg-yellow-200/60':''} ${strong? 'font-semibold':''}`;
  const rightClass = `border p-2 text-right ${strong? 'font-semibold':''}`;
  return (
    <tr>
      <td className="border p-0" />
      {values.map((val, i) => (
        <td key={i} className={(i%6<3 && highlightLeft) ? cellClass : rightClass}>{val ? fmt(val) : '-'}</td>
      ))}
      {[0,1,2,3].map(q=> (
        <td key={`ct-${q}`} className={`border p-2 text-right ${highlightLeft? 'bg-yellow-200/60':''} ${strong? 'font-semibold':''}`}>{fmt(quarterTotals[q]||0)}</td>
      ))}
    </tr>
  );
}

function patch(arr: number[], i: number, v: number) { const next = arr.slice(); next[i]=round2(v); return next; }
function patchNum(arr: number[], i: number, v: number) { const next = arr.slice(); next[i]=v; return next; }
function sum(a: number[]) { return a.reduce((s,n)=> s + (Number(n)||0), 0); }
function round2(n: number) { return Math.round((Number(n)||0) * 100) / 100; }
function formatInput(n: number) { return Number.isFinite(n) ? String(n) : "0"; }
