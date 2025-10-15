"use client";
import { useEffect, useMemo, useState } from "react";
import { API_BASE, api } from "@/lib/api";
import { useAuthRequired } from "@/lib/useAuth";

type Supplier = { id: number; name: string };
type Account = { id: number; code: string; name: string; type: string };
type Line = { account_id?: number; description?: string; qty?: number; unit_price?: number; amount?: number };

export default function ApBillsPage() {
  useAuthRequired();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const exportCsv = async () => {
    const token = localStorage.getItem('token');
    const org = localStorage.getItem('org_id') || '';
    const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([_,v])=>v)) as any);
    const res = await fetch(`${API_BASE}/exports/ap/bills?${params.toString()}`, { headers: { Authorization: `Bearer ${token||''}`, 'X-Org-Id': org } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ap_bills.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const [filters, setFilters] = useState<{status?: string; supplier_id?: string; date_from?: string; date_to?: string; q?: string}>({});
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string,string[]>>({});
  const [form, setForm] = useState<{supplier_id?: number; bill_no?: string; bill_date?: string; lines: Line[]}>({ lines: [{},{}] });
  const [editModal, setEditModal] = useState<{id?: number; data?: any} | null>(null);
  const [postModal, setPostModal] = useState<{id?: number, ap_account_id?: number} | null>(null);

  const apCandidates = useMemo(() => accounts.filter(a=>a.type==='liability'), [accounts]);

  const load = () => {
    const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([_,v])=>v)) as any);
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    const qs = params.toString();
    Promise.all([
      api(`/suppliers`),
      api(`/accounts`),
      api(`/ap/bills${qs?`?${qs}`:''}`),
    ])
      .then(([sup, acc, bills]) => {
        setSuppliers(Array.isArray(sup?.data) ? sup.data : sup);
        setAccounts(Array.isArray(acc) ? acc : acc?.data || []);
        if (Array.isArray(bills?.data)) {
          setList(bills.data);
          setPage(bills.current_page || 1);
          setLastPage(bills.last_page || 1);
          setTotal(bills.total || bills.data.length);
        } else {
          setList(bills);
          setLastPage(1);
          setTotal(bills.length || 0);
        }
      })
      .catch((e:any) => setError(e?.message || String(e)));
  };

  useEffect(() => { setPage(1); }, [filters, perPage]);
  useEffect(() => { load(); }, [filters, page, perPage]);

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setForm(prev => {
      const lines = [...prev.lines];
      const next = { ...lines[idx], ...patch } as Line;
      next.qty = Number(next.qty ?? 0); next.unit_price = Number(next.unit_price ?? 0); next.amount = Number((next.qty || 0) * (next.unit_price || 0));
      lines[idx] = next;
      return { ...prev, lines };
    });
  };

  const addLine = () => setForm(prev => ({...prev, lines: [...prev.lines, {}]}));

  const validateLines = (lines: Line[]) => {
    if (!lines.length) return 'At least one line is required';
    for (const [i,ln] of lines.entries()) {
      if (!ln.account_id) return `Line ${i+1}: account is required`;
      if (!ln.description) return `Line ${i+1}: description is required`;
      if ((ln.qty??0) < 0) return `Line ${i+1}: qty must be >= 0`;
      if ((ln.unit_price??0) < 0) return `Line ${i+1}: unit price must be >= 0`;
    }
    const total = lines.reduce((s,ln)=>s+Number(ln.amount||0),0);
    if (total <= 0) return 'Total must be greater than zero';
    return null;
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const verr = validateLines(form.lines);
    if (verr) { setError(verr); return; }
    try {
      await api('/ap/bills', { method: 'POST', body: JSON.stringify(form) });
      setForm({ lines: [{},{}] });
      setFormErrors({});
      load();
    } catch (err: any) { setError(err.message || 'Failed'); setFormErrors(err.errors||{}); }
  };

  const post = async () => {
    if (!postModal?.id || !postModal?.ap_account_id) return;
    try {
      await api(`/ap/bills/${postModal.id}/post`, { method: 'POST', body: JSON.stringify({ ap_account_id: postModal.ap_account_id }) });
      setPostModal(null); load();
    } catch (err: any) { setError(err.message || 'Failed'); }
  };

  const subtotal = form.lines.reduce((s,ln)=>s+Number(ln.amount||0),0);

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">AP Bills</h1>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="grid grid-cols-5 gap-2 mb-2">
        <select value={filters.status||''} onChange={e=>setFilters({...filters, status:e.target.value||undefined})} className="border rounded px-2 py-1">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
        </select>
        <select value={filters.supplier_id||''} onChange={e=>setFilters({...filters, supplier_id:e.target.value||undefined})} className="border rounded px-2 py-1">
          <option value="">All Suppliers</option>
          {suppliers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={filters.date_from||''} onChange={e=>setFilters({...filters, date_from:e.target.value||undefined})} className="border rounded px-2 py-1" />
        <input type="date" value={filters.date_to||''} onChange={e=>setFilters({...filters, date_to:e.target.value||undefined})} className="border rounded px-2 py-1" />
        <div className="flex items-center gap-2">
          <input placeholder="Search No" value={filters.q||''} onChange={e=>setFilters({...filters, q:e.target.value||undefined})} className="border rounded px-2 py-1" />
          <select value={perPage} onChange={e=>setPerPage(Number(e.target.value))} className="border rounded px-2 py-1">
            {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end mb-2">
        <button onClick={exportCsv} className="border px-3 py-1 rounded text-sm">Export CSV</button>
      </div>
      <form onSubmit={create} className="space-y-2 border rounded p-3 mb-6">
        <div className="grid grid-cols-4 gap-2">
          <select required value={form.supplier_id||''} onChange={e=>setForm({...form, supplier_id: Number(e.target.value)})} className="border rounded px-2 py-1">
            <option value="">Supplier</option>
            {suppliers.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div>
            <input placeholder="Bill No" required value={form.bill_no||''} onChange={e=>setForm({...form, bill_no:e.target.value})} className="border rounded px-2 py-1 w-full" />
            {formErrors.bill_no && <p className="text-xs text-red-600">{formErrors.bill_no.join(', ')}</p>}
          </div>
          <div>
            <input type="date" required value={form.bill_date||''} onChange={e=>setForm({...form, bill_date:e.target.value})} className="border rounded px-2 py-1 w-full" />
            {formErrors.bill_date && <p className="text-xs text-red-600">{formErrors.bill_date.join(', ')}</p>}
          </div>
        </div>
        <div>
          <table className="w-full border text-sm">
            <thead><tr className="bg-gray-50"><th className="p-1 border">Account</th><th className="p-1 border">Description</th><th className="p-1 border">Qty</th><th className="p-1 border">Unit Price</th><th className="p-1 border">Amount</th></tr></thead>
            <tbody>
            {form.lines.map((ln, i) => (
              <tr key={i}>
                <td className="border p-1">
                  <select value={ln.account_id||''} onChange={e=>updateLine(i, { account_id: Number(e.target.value) })} className="border rounded px-1 py-1 w-full">
                    <option value="">Expense Account</option>
                    {accounts.map(a=> <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </td>
                <td className="border p-1"><input value={ln.description||''} onChange={e=>updateLine(i, { description: e.target.value })} className="border rounded px-1 py-1 w-full"/></td>
                <td className="border p-1"><input type="number" step="0.0001" value={ln.qty||''} onChange={e=>updateLine(i, { qty: Number(e.target.value) })} className="border rounded px-1 py-1 w-full"/></td>
                <td className="border p-1"><input type="number" step="0.01" value={ln.unit_price||''} onChange={e=>updateLine(i, { unit_price: Number(e.target.value) })} className="border rounded px-1 py-1 w-full"/></td>
                <td className="border p-1 text-right">{(ln.amount||0).toFixed(2)}</td>
              </tr>
            ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-2">
            <button type="button" onClick={addLine} className="text-sm text-teal-700">+ Add line</button>
            <div className="text-sm">Subtotal: <span className="font-medium">{subtotal.toFixed(2)}</span></div>
          </div>
        </div>
        {Object.keys(formErrors).some(k=>k.startsWith('lines.')) && (
          <div className="text-xs text-red-600">Line errors: {Object.entries(formErrors).filter(([k])=>k.startsWith('lines.')).map(([k,v])=>`${k}: ${v.join(', ')}`).join('; ')}</div>
        )}
        <button className="bg-teal-600 text-white px-3 py-1 rounded">Create</button>
      </form>

      <table className="w-full border text-sm">
        <thead><tr className="bg-gray-50"><th className="p-2 border">No</th><th className="p-2 border">Supplier</th><th className="p-2 border">Date</th><th className="p-2 border">Total</th><th className="p-2 border">Status</th><th className="p-2 border">Actions</th></tr></thead>
        <tbody>
          {list.map((r: any) => (
            <tr key={r.id}>
              <td className="p-2 border">{r.bill_no}</td>
              <td className="p-2 border">{r.supplier?.name || ''}</td>
              <td className="p-2 border">{r.bill_date}</td>
              <td className="p-2 border text-right">{Number(r.total||0).toFixed(2)}</td>
              <td className="p-2 border">{r.status}</td>
              <td className="p-2 border">
                {r.status==='draft' && (
                  <>
                    <button onClick={()=>setEditModal({ id: r.id, data: r })} className="text-sm text-teal-700 underline mr-2">Edit</button>
                    <button onClick={()=>setPostModal({ id: r.id })} className="text-sm text-teal-700 underline mr-2">Post</button>
                    <button onClick={async()=>{ if(confirm('Delete bill?')){ try{ await api(`/ap/bills/${r.id}`, { method:'DELETE' }); load(); }catch(e:any){ setError(e.message||'Failed'); } } }} className="text-sm text-red-700 underline">Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
      <div className="text-right text-sm mt-2">List Total: <span className="font-medium">{list.reduce((s,x)=>s+Number(x.total||0),0).toFixed(2)}</span></div>

      {editModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white p-4 rounded shadow w-full max-w-3xl">
            <h2 className="font-semibold mb-3">Edit Bill</h2>
            <EditBillModal data={editModal.data} accounts={accounts} suppliers={suppliers} onClose={()=>setEditModal(null)} onSaved={()=>{setEditModal(null); load();}} setError={setError} />
          </div>
        </div>
      )}

      {postModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white p-4 rounded shadow w-full max-w-md">
            <h2 className="font-semibold mb-2">Post Bill</h2>
            <select value={postModal.ap_account_id||''} onChange={e=>setPostModal({...postModal, ap_account_id: Number(e.target.value)})} className="border rounded px-2 py-1 w-full mb-1">
              <option value="">Select AP Account</option>
              {apCandidates.map(a=> <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
            {!postModal.ap_account_id && <p className="text-xs text-red-600 mb-2">AP account is required</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setPostModal(null)} className="px-3 py-1">Cancel</button>
              <button onClick={post} disabled={!postModal.ap_account_id} className={`px-3 py-1 rounded ${!postModal.ap_account_id?'opacity-50 border':'bg-teal-600 text-white'}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pagination({ page, lastPage, total, onChange }: { page: number; lastPage: number; total: number; onChange: (p:number)=>void }) {
  const makePages = () => {
    const pages: (number|string)[] = [];
    const add = (p:number)=>{ if (!pages.includes(p)) pages.push(p); };
    add(1);
    for (let p=page-2; p<=page+2; p++) if (p>1 && p<lastPage) add(p);
    if (lastPage>1) add(lastPage);
    const result: (number|string)[] = [];
    let prev = 0;
    for (const p of pages.sort((a:any,b:any)=>Number(a)-Number(b))) {
      if (typeof p==='number' && prev && p-prev>1) result.push('...');
      result.push(p);
      prev = Number(p);
    }
    return result;
  };
  const items = makePages();
  return (
    <div className="flex items-center justify-between mt-2 text-sm">
      <div>Total: {total}</div>
      <div className="flex items-center gap-1">
        <button disabled={page<=1} onClick={()=>onChange(Math.max(1,page-1))} className={`px-2 py-1 border rounded ${page<=1?'opacity-50':''}`}>Prev</button>
        {items.map((it,i)=> typeof it==='number' ? (
          <button key={i} onClick={()=>onChange(it)} className={`px-2 py-1 border rounded ${it===page?'bg-teal-600 text-white':''}`}>{it}</button>
        ) : (
          <span key={i} className="px-2">{it}</span>
        ))}
        <button disabled={page>=lastPage} onClick={()=>onChange(Math.min(lastPage,page+1))} className={`px-2 py-1 border rounded ${page>=lastPage?'opacity-50':''}`}>Next</button>
      </div>
    </div>
  );
}

function EditBillModal({ data, accounts, suppliers, onClose, onSaved, setError }: any) {
  const [form, setForm] = useState<any>({
    supplier_id: data.supplier_id,
    bill_no: data.bill_no,
    bill_date: (data.bill_date||'').slice(0,10),
    lines: (data.lines||[]).map((l:any)=>({ account_id:l.account_id, description:l.description, qty:l.qty||1, unit_price:l.unit_price||l.amount }))
  });
  const [errors, setErrors] = useState<Record<string,string[]>>({});
  const subtotal = form.lines.reduce((s:number,ln:any)=>s+Number((ln.qty||0)*(ln.unit_price||0)),0);
  const updateLine = (idx:number,patch:any)=>{
    setForm((prev:any)=>{ const lines=[...prev.lines]; lines[idx]={...lines[idx],...patch}; return {...prev,lines}; });
  };
  const addLine = ()=> setForm((p:any)=>({...p, lines:[...p.lines, {}]}));
  const save = async (e:any)=>{
    e.preventDefault();
    try { await api(`/ap/bills/${data.id}`, { method:'PUT', body: JSON.stringify(form) }); setErrors({}); onSaved(); } catch(e:any){ setError(e.message||'Failed'); setErrors(e.errors||{}); }
  };
  return (
    <form onSubmit={save} className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <select required value={form.supplier_id||''} onChange={(e)=>setForm({...form, supplier_id:Number(e.target.value)})} className="border rounded px-2 py-1">
          <option value="">Supplier</option>
          {suppliers.map((c:any)=>(<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
        <div>
          <input value={form.bill_no} onChange={e=>setForm({...form, bill_no:e.target.value})} className="border rounded px-2 py-1 w-full" />
          {errors.bill_no && <p className="text-xs text-red-600">{errors.bill_no.join(', ')}</p>}
        </div>
        <div>
          <input type="date" value={form.bill_date} onChange={e=>setForm({...form, bill_date:e.target.value})} className="border rounded px-2 py-1 w-full" />
          {errors.bill_date && <p className="text-xs text-red-600">{errors.bill_date.join(', ')}</p>}
        </div>
      </div>
      <table className="w-full border text-sm">
        <thead><tr className="bg-gray-50"><th className="p-1 border">Account</th><th className="p-1 border">Description</th><th className="p-1 border">Qty</th><th className="p-1 border">Unit Price</th><th className="p-1 border">Amount</th></tr></thead>
        <tbody>
          {form.lines.map((ln:any,i:number)=> (
            <tr key={i}>
              <td className="border p-1"><select value={ln.account_id||''} onChange={e=>updateLine(i,{account_id:Number(e.target.value)})} className="border rounded px-1 py-1 w-full"><option value="">Expense</option>{accounts.map((a:any)=>(<option key={a.id} value={a.id}>{a.code} - {a.name}</option>))}</select></td>
              <td className="border p-1"><input value={ln.description||''} onChange={e=>updateLine(i,{description:e.target.value})} className="border rounded px-1 py-1 w-full"/></td>
              <td className="border p-1"><input type="number" step="0.0001" value={ln.qty||''} onChange={e=>updateLine(i,{qty:Number(e.target.value)})} className="border rounded px-1 py-1 w-full"/></td>
              <td className="border p-1"><input type="number" step="0.01" value={ln.unit_price||''} onChange={e=>updateLine(i,{unit_price:Number(e.target.value)})} className="border rounded px-1 py-1 w-full"/></td>
              <td className="border p-1 text-right">{(((ln.qty||0)*(ln.unit_price||0))||0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {Object.keys(errors).some(k=>k.startsWith('lines.')) && (
        <div className="text-xs text-red-600">Line errors: {Object.entries(errors).filter(([k])=>k.startsWith('lines.')).map(([k,v])=>`${k}: ${v.join(', ')}`).join('; ')}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <button type="button" onClick={addLine} className="text-sm text-teal-700">+ Add line</button>
        <div className="text-sm">Subtotal: <span className="font-medium">{subtotal.toFixed(2)}</span></div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-3 py-1">Cancel</button>
        <button className="bg-teal-600 text-white px-3 py-1 rounded">Save</button>
      </div>
    </form>
  );
}
