"use client";
import { useEffect, useMemo, useState } from "react";
import { API_BASE, api } from "@/lib/api";
import { useAuthRequired } from "@/lib/useAuth";

type Account = { id: number; code: string; name: string; type: string; parent_id?: number|null };

export default function AccountsPage() {
  useAuthRequired();
  const [list, setList] = useState<Account[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{key: string, dir: 'asc'|'desc'}>({ key: 'code', dir: 'asc' });
  const [showModal, setShowModal] = useState<{mode:'create'|'edit', data?: Account}|null>(null);

  const accountTypes = useMemo(()=>['asset','liability','equity','revenue','expense','contra_asset','contra_liability','contra_equity','other'],[]);
  const exportCsv = async () => {
    const token = localStorage.getItem('token');
    const org = localStorage.getItem('org_id') || '';
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage), sort: sort.key, dir: sort.dir });
    const res = await fetch(`${API_BASE}/exports/accounts?${params.toString()}`, { headers: { Authorization: `Bearer ${token||''}`, 'X-Org-Id': org } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='accounts.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const load = () => {
    const qs = `?page=${page}&per_page=${perPage}&sort=${encodeURIComponent(sort.key)}&dir=${sort.dir}`;
    api(`/accounts${qs}`)
      .then((data) => {
        if (Array.isArray(data?.data)) {
          setList(data.data);
          setPage(data.current_page || 1);
          setLastPage(data.last_page || 1);
          setTotal(data.total || data.data.length);
        } else {
          setList(data);
          setLastPage(1);
          setTotal(data.length || 0);
        }
      })
      .catch((e:any) => setError(String(e?.message || e)));
  };

  useEffect(() => { load(); }, [page, perPage]);

  const remove = async (id: number) => {
    if (!confirm('Delete account? This cannot be undone.')) return;
    try {
      await api(`/accounts/${id}`, { method: 'DELETE' });
      load();
    } catch (e:any) {
      setError(e.message || 'Delete failed');
    }
  };

  const headerClick = (key: string) => {
    setSort(s => s.key === key ? { key, dir: s.dir==='asc'?'desc':'asc' } : { key, dir: 'asc' });
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Chart of Accounts</h1>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="flex items-center gap-2 mb-4">
        <select value={perPage} onChange={e=>setPerPage(Number(e.target.value))} className="border rounded px-2 py-1">
          {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/page</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={()=>setShowModal({mode:'create'})} className="bg-teal-600 text-white px-3 py-1 rounded text-sm">New Account</button>
        <button onClick={exportCsv} className="border px-3 py-1 rounded text-sm">Export CSV</button>
      </div>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-2 border cursor-pointer" onClick={()=>headerClick('code')}>Code {sort.key==='code' ? (sort.dir==='asc'?'↑':'↓') : ''}</th>
            <th className="p-2 border cursor-pointer" onClick={()=>headerClick('name')}>Name {sort.key==='name' ? (sort.dir==='asc'?'↑':'↓') : ''}</th>
            <th className="p-2 border cursor-pointer" onClick={()=>headerClick('type')}>Type {sort.key==='type' ? (sort.dir==='asc'?'↑':'↓') : ''}</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map(a => (
            <tr key={a.id}>
              <td className="p-2 border">{a.code}</td>
              <td className="p-2 border">{a.name}</td>
              <td className="p-2 border">{a.type}</td>
              <td className="p-2 border text-right">
                <button onClick={()=>setShowModal({mode:'edit', data:a})} className="text-sm text-teal-700 underline mr-2">Edit</button>
                <button onClick={()=>remove(a.id)} className="text-sm text-red-700 underline">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />

      {showModal && (
        <AccountModal
          mode={showModal.mode}
          data={showModal.data}
          onClose={()=>setShowModal(null)}
          onSaved={()=>{ setShowModal(null); load(); }}
        />
      )}
    </div>
  );
}

function AccountModal({ mode, data, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>({
    code: data?.code || '',
    name: data?.name || '',
    type: data?.type || '',
    parent_id: data?.parent_id || ''
  });
  const [errors, setErrors] = useState<Record<string,string[]>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const accountTypes = ['asset','liability','equity','revenue','expense','contra_asset','contra_liability','contra_equity','other'];

  useEffect(()=>{
    // fetch without pagination to populate parent list
    api(`/accounts`)
      .then((res:any)=>{
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        setAccounts(Array.isArray(list) ? list : []);
      })
      .catch(()=>{});
  },[]);

  const submit = async (e:any) => {
    e.preventDefault();
    try {
      if (mode==='create') await api('/accounts', { method:'POST', body: JSON.stringify(form) });
      else await api(`/accounts/${data.id}`, { method:'PUT', body: JSON.stringify(form) });
      setErrors({});
      onSaved();
    } catch (e:any) {
      setErrors(e.errors||{});
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white p-4 rounded shadow w-full max-w-lg">
        <h2 className="font-semibold mb-3">{mode==='create' ? 'New Account' : 'Edit Account'}</h2>
        <form onSubmit={submit} className="space-y-2">
          <div>
            <label className="text-xs text-gray-600">Code</label>
            <input value={form.code} onChange={e=>setForm({...form, code:e.target.value})} onBlur={async()=>{
              try { const res = await api(`/accounts/check-code?code=${encodeURIComponent(form.code)}${mode==='edit'&&data?.id?`&exclude_id=${data.id}`:''}`); if (res.exists) setErrors(prev=>({...prev, code:["Code already exists"]})); else setErrors(prev=>({...prev, code:[]})); } catch {}
            }} className="border rounded px-2 py-1 w-full" />
            {errors.code && <p className="text-xs text-red-600">{errors.code.join(', ')}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-600">Name</label>
            <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="border rounded px-2 py-1 w-full" />
            {errors.name && <p className="text-xs text-red-600">{errors.name.join(', ')}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-600">Type</label>
            <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})} className="border rounded px-2 py-1 w-full">
              <option value="">Select type</option>
              {accountTypes.map(t=> <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.type && <p className="text-xs text-red-600">{errors.type.join(', ')}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-600">Parent (optional)</label>
            <select value={form.parent_id||''} onChange={e=>setForm({...form, parent_id: e.target.value ? Number(e.target.value) : ''})} className="border rounded px-2 py-1 w-full">
              <option value="">No parent</option>
              {accounts.filter(a=>!data || a.id!==data.id).map(a=> <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
            {errors.parent_id && <p className="text-xs text-red-600">{errors.parent_id.join(', ')}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1">Cancel</button>
            <button disabled={!form.code || !form.name || !form.type || (errors.code&&errors.code.length>0)} className={`px-3 py-1 rounded ${(!form.code || !form.name || !form.type || (errors.code&&errors.code.length>0))?'opacity-50 border':'bg-teal-600 text-white'}`}>Save</button>
          </div>
        </form>
      </div>
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
