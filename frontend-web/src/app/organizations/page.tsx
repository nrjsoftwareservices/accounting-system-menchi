"use client";
import { useEffect, useState } from "react";
import { API_BASE, api } from "@/lib/api";
import { useAuthRequired } from "@/lib/useAuth";

type Org = { id: number; name: string; code: string; default_currency?: string, pivot?: { role?: string } };

export default function OrganizationsPage() {
  useAuthRequired();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [sort, setSort] = useState<{key: string, dir: 'asc'|'desc'}>({ key: 'id', dir: 'asc' });
  const [form, setForm] = useState<Partial<Org>>({ default_currency: "USD" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Org | null>(null);
  const [settings, setSettings] = useState<any>({ imports: { sales:{}, purchases:{} } });
  const [savingSettings, setSavingSettings] = useState(false);

  const load = () => {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage), sort: sort.key, dir: sort.dir });
    fetch(`${API_BASE}/organizations?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.text())))
      .then((data) => {
        if (Array.isArray(data?.data)) {
          setOrgs(data.data); setPage(data.current_page||1); setLastPage(data.last_page||1); setTotal(data.total||data.data.length);
        } else {
          setOrgs(data); setLastPage(1); setTotal(data.length||0);
        }
      })
      .catch((e) => setError(String(e)));
  };

  useEffect(() => { load(); }, [page, perPage, sort]);

  // Load current client settings into the mapping form
  useEffect(() => {
    const current = localStorage.getItem('org_id');
    if (!current) return;
    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/organizations?page=1&per_page=200`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r=>r.json())
      .then(data=>{
        const list: any[] = Array.isArray(data?.data) ? data.data : data;
        const org = list.find(o=> String(o.id) === String(current));
        if (org?.settings) setSettings(org.settings);
      })
      .catch(()=>{});
  }, []);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingSettings(true);
    try {
      const current = localStorage.getItem('org_id');
      if (!current) return;
      // Need name/code to pass validation; fetch from existing list
      const org = orgs.find(o=> String(o.id) === String(current));
      if (!org) return;
      await api(`/organizations/${org.id}`, { method:'PUT', body: JSON.stringify({ name: org.name, code: org.code, default_currency: org.default_currency, settings }) });
    } catch (e) {
      // noop; errors are returned as messages
    } finally { setSavingSettings(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setFieldErrors({}); setLoading(true);
    try {
      const res = await api('/organizations', { method: 'POST', body: JSON.stringify(form) });
      // optional: set the new org as current
      if (res?.id) localStorage.setItem('org_id', String(res.id));
      setForm({ default_currency: 'USD' });
      load();
    } catch (err: any) {
      setError(err.message || 'Failed');
      setFieldErrors(err.errors || {});
    } finally { setLoading(false); }
  };

  const currentOrg = typeof window !== 'undefined' ? localStorage.getItem('org_id') : null;
  const canCreate = orgs.length === 0 || orgs.some(o => (o as any)?.pivot?.role === 'admin');

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Clients</h1>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="mb-3 text-xs text-gray-600">Current Client Context: <span className="font-medium">{currentOrg || 'none selected'}</span>.</div>
      <div className="mb-3 text-sm">Admin Check: {canCreate ? <span className="text-green-700 font-medium">You can create new organizations</span> : <span className="text-red-700 font-medium">You are not an admin in any org</span>}</div>

      <form onSubmit={submit} className="border rounded p-3 mb-6 space-y-2">
        <div>
          <label className="text-xs text-gray-600">Name</label>
          <input required className="border rounded px-2 py-1 w-full" value={form.name||''} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Client name" />
          {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name.join(', ')}</p>}
        </div>
        <div>
          <label className="text-xs text-gray-600">Code</label>
          <input required className="border rounded px-2 py-1 w-full" value={form.code||''} onChange={e=>setForm({...form, code:e.target.value})} placeholder="Unique code (e.g., ACME)" />
          {fieldErrors.code && <p className="text-xs text-red-600">{fieldErrors.code.join(', ')}</p>}
        </div>
        <div>
          <label className="text-xs text-gray-600">Default Currency</label>
          <input className="border rounded px-2 py-1 w-full" value={form.default_currency||''} onChange={e=>setForm({...form, default_currency:e.target.value})} placeholder="USD" />
          {fieldErrors.default_currency && <p className="text-xs text-red-600">{fieldErrors.default_currency.join(', ')}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button disabled={loading || !canCreate} className={`px-3 py-1 rounded ${loading || !canCreate?'opacity-50 border':'bg-teal-600 text-white'}`}>Create Client</button>
        </div>
      </form>

      <form onSubmit={saveSettings} className="border rounded p-3 mb-6 space-y-2">
        <h2 className="font-medium">Client Import Mappings</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="col-span-2 font-medium">Sales</div>
          <label className="flex items-center gap-2"><span className="w-56">AR account code</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.sales?.ar_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, sales:{...s.imports?.sales, ar_account_code:e.target.value}}}))} /></label>
          <label className="flex items-center gap-2"><span className="w-56">VAT payable code</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.sales?.vat_payable_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, sales:{...s.imports?.sales, vat_payable_account_code:e.target.value}}}))} /></label>
          <label className="flex items-center gap-2"><span className="w-56">Sales (goods) code</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.sales?.sales_goods_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, sales:{...s.imports?.sales, sales_goods_account_code:e.target.value}}}))} /></label>
          <label className="flex items-center gap-2"><span className="w-56">Sales (services) code</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.sales?.sales_services_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, sales:{...s.imports?.sales, sales_services_account_code:e.target.value}}}))} /></label>
          <label className="flex items-center gap-2"><span className="w-56">Sales exempt code</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.sales?.sales_exempt_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, sales:{...s.imports?.sales, sales_exempt_account_code:e.target.value}}}))} /></label>
          <label className="flex items-center gap-2"><span className="w-56">Sales discount code</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.sales?.sales_discount_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, sales:{...s.imports?.sales, sales_discount_account_code:e.target.value}}}))} /></label>

          <div className="col-span-2 font-medium mt-4">Purchases & Expenses</div>
          <label className="flex items-center gap-2"><span className="w-56">Credit (default) account code</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.purchases?.credit_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, purchases:{...s.imports?.purchases, credit_account_code:e.target.value}}}))} /></label>
          <label className="flex items-center gap-2"><span className="w-56">Cash account code</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.purchases?.cash_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, purchases:{...s.imports?.purchases, cash_account_code:e.target.value}}}))} /></label>
          <label className="flex items-center gap-2"><span className="w-56">Input VAT account code</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.purchases?.input_vat_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, purchases:{...s.imports?.purchases, input_vat_account_code:e.target.value}}}))} /></label>
          <label className="flex items-center gap-2"><span className="w-56">Expense (VATable) account</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.purchases?.expense_vatable_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, purchases:{...s.imports?.purchases, expense_vatable_account_code:e.target.value}}}))} /></label>
          <label className="flex items-center gap-2"><span className="w-56">Expense (Non‑VAT) account</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.purchases?.expense_non_vat_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, purchases:{...s.imports?.purchases, expense_non_vat_account_code:e.target.value}}}))} /></label>
          <label className="flex items-center gap-2"><span className="w-56">Default expense account</span><input className="border rounded px-2 py-1 flex-1" value={settings?.imports?.purchases?.default_expense_account_code||''} onChange={e=>setSettings((s:any)=>({...s, imports:{...s.imports, purchases:{...s.imports?.purchases, default_expense_account_code:e.target.value}}}))} /></label>
        </div>
        <div className="flex justify-end"><button disabled={savingSettings} className={`px-3 py-1 rounded ${savingSettings?'opacity-50 border':'bg-teal-600 text-white'}`}>Save Mappings</button></div>
      </form>

      <div className="flex items-center justify-between mb-2">
        <div/>
        <select value={perPage} onChange={e=>{ setPerPage(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-1 text-sm">
          {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/page</option>)}
        </select>
      </div>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-2 border cursor-pointer" onClick={()=>setSort(s=>({ key:'id', dir: s.key==='id'&&s.dir==='asc'?'desc':'asc' }))}>ID {sort.key==='id'?(sort.dir==='asc'?'↑':'↓'):''}</th>
            <th className="p-2 border cursor-pointer" onClick={()=>setSort(s=>({ key:'code', dir: s.key==='code'&&s.dir==='asc'?'desc':'asc' }))}>Code {sort.key==='code'?(sort.dir==='asc'?'↑':'↓'):''}</th>
            <th className="p-2 border cursor-pointer" onClick={()=>setSort(s=>({ key:'name', dir: s.key==='name'&&s.dir==='asc'?'desc':'asc' }))}>Name {sort.key==='name'?(sort.dir==='asc'?'↑':'↓'):''}</th>
            <th className="p-2 border">Default Currency</th>
            <th className="p-2 border">Role</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map(o => (
            <tr key={o.id}>
              <td className="p-2 border">{o.id}</td>
              <td className="p-2 border">{o.code}</td>
              <td className="p-2 border">{o.name}</td>
              <td className="p-2 border">{o.default_currency || 'USD'}</td>
              <td className="p-2 border">{o.pivot?.role || '-'}</td>
              <td className="p-2 border text-right space-x-2">
                <button className="text-sm text-teal-700 underline" onClick={()=>{ localStorage.setItem('org_id', String(o.id)); location.reload(); }}>Use</button>
                <button className="text-sm text-teal-700 underline" onClick={()=>setEdit(o)}>Edit</button>
                {(o.pivot?.role === 'admin') && (
                  <button className="text-sm text-red-700 underline" onClick={async()=>{ if (confirm('Delete organization and all its data?')) { try { await api(`/organizations/${o.id}`, { method:'DELETE' }); if (currentOrg === String(o.id)) { localStorage.removeItem('org_id'); } load(); } catch(e:any){ setError(e.message||'Failed'); } } }}>Delete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />

      {edit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white p-4 rounded shadow w-full max-w-lg">
            <h2 className="font-semibold mb-3">Edit Organization</h2>
            <EditOrgModal value={edit} onClose={()=>setEdit(null)} onSaved={()=>{ setEdit(null); load(); }} />
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

function EditOrgModal({ value, onClose, onSaved }: { value: Org, onClose: ()=>void, onSaved: ()=>void }) {
  const [form, setForm] = useState<Partial<Org>>({ name: value.name, code: value.code, default_currency: value.default_currency || 'PHP' });
  const [errors, setErrors] = useState<Record<string,string[]>>({});
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await api(`/organizations/${value.id}`, { method:'PUT', body: JSON.stringify(form) });
      setErrors({}); onSaved();
    } catch(e:any) {
      setErrors(e.errors||{});
    } finally { setSaving(false); }
  };
  return (
    <form onSubmit={save} className="space-y-2">
      <div>
        <label className="text-xs text-gray-600">Name</label>
        <input className="border rounded px-2 py-1 w-full" value={form.name||''} onChange={e=>setForm({...form, name:e.target.value})} />
        {errors.name && <p className="text-xs text-red-600">{errors.name.join(', ')}</p>}
      </div>
      <div>
        <label className="text-xs text-gray-600">Code</label>
        <input className="border rounded px-2 py-1 w-full" value={form.code||''} onChange={e=>setForm({...form, code:e.target.value})} />
        {errors.code && <p className="text-xs text-red-600">{errors.code.join(', ')}</p>}
      </div>
      <div>
        <label className="text-xs text-gray-600">Default Currency</label>
        <input className="border rounded px-2 py-1 w-full" value={form.default_currency||''} onChange={e=>setForm({...form, default_currency:e.target.value})} />
        {errors.default_currency && <p className="text-xs text-red-600">{errors.default_currency.join(', ')}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1">Cancel</button>
        <button disabled={saving} className={`px-3 py-1 rounded ${saving?'opacity-50 border':'bg-teal-600 text-white'}`}>Save</button>
      </div>
    </form>
  );
}
