"use client";
import { useEffect, useState } from "react";
import { API_BASE, api } from "@/lib/api";
import { useAuthRequired } from "@/lib/useAuth";

type Customer = { id: number; code?: string; name: string; email?: string; phone?: string };

export default function CustomersPage() {
  useAuthRequired();
  const [list, setList] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string,string[]>>({});
  const [sort, setSort] = useState<{key: string, dir: 'asc'|'desc'}>({ key: 'name', dir: 'asc' });
  const exportCsv = async () => {
    const token = localStorage.getItem('token');
    const org = localStorage.getItem('org_id') || '';
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage), sort: sort.key, dir: sort.dir });
    if (search) params.set('search', search);
    const res = await fetch(`${API_BASE}/exports/customers?${params.toString()}`, { headers: { Authorization: `Bearer ${token||''}`, 'X-Org-Id': org } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='customers.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const [editErrors, setEditErrors] = useState<Record<string,string[]>>({});

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    params.set('sort', sort.key);
    params.set('dir', sort.dir);
    const qs = params.toString() ? `?${params.toString()}` : "";
    api(`/customers${qs}`)
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

  useEffect(() => { setPage(1); }, [search, perPage]);
  useEffect(() => { load(); }, [search, page, perPage]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try {
      await api('/customers', { method: 'POST', body: JSON.stringify(form) });
      setForm({});
      setFieldErrors({});
      load();
    } catch (err: any) { setError(err.message || 'Failed'); setFieldErrors(err.errors||{}); }
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Customers</h1>
      {error && <p className="text-red-600 mb-3 text-sm">{error}</p>}
      <div className="flex items-center gap-2 mb-4">
        <input placeholder="Search name/code/email" value={search} onChange={e=>setSearch(e.target.value)} className="border rounded px-2 py-1 w-full max-w-md" />
        <select value={perPage} onChange={e=>setPerPage(Number(e.target.value))} className="border rounded px-2 py-1">
          {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/page</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div/>
        <button onClick={exportCsv} className="border px-3 py-1 rounded text-sm">Export CSV</button>
      </div>
      <form onSubmit={create} className="grid grid-cols-5 gap-2 mb-4">
        <div>
          <input placeholder="Code" value={form.code||''} onChange={e=>setForm({...form, code:e.target.value})} className="border px-2 py-1 rounded w-full" />
          {fieldErrors.code && <p className="text-xs text-red-600">{fieldErrors.code.join(', ')}</p>}
        </div>
        <div className="col-span-2">
          <input placeholder="Name" required value={form.name||''} onChange={e=>setForm({...form, name:e.target.value})} className="border px-2 py-1 rounded w-full" />
          {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name.join(', ')}</p>}
        </div>
        <div>
          <input placeholder="Email" value={form.email||''} onChange={e=>setForm({...form, email:e.target.value})} className="border px-2 py-1 rounded w-full" />
          {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email.join(', ')}</p>}
        </div>
        <div>
          <input placeholder="Phone" value={form.phone||''} onChange={e=>setForm({...form, phone:e.target.value})} className="border px-2 py-1 rounded w-full" />
          {fieldErrors.phone && <p className="text-xs text-red-600">{fieldErrors.phone.join(', ')}</p>}
        </div>
        <button className="bg-teal-600 text-white px-3 py-1 rounded col-span-5 sm:col-span-1">Add</button>
      </form>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-2 border cursor-pointer" onClick={()=>setSort(s=>({ key:'code', dir: s.key==='code'&&s.dir==='asc'?'desc':'asc' }))}>Code {sort.key==='code' ? (sort.dir==='asc'?'↑':'↓'):''}</th>
            <th className="p-2 border cursor-pointer" onClick={()=>setSort(s=>({ key:'name', dir: s.key==='name'&&s.dir==='asc'?'desc':'asc' }))}>Name {sort.key==='name' ? (sort.dir==='asc'?'↑':'↓'):''}</th>
            <th className="p-2 border cursor-pointer" onClick={()=>setSort(s=>({ key:'email', dir: s.key==='email'&&s.dir==='asc'?'desc':'asc' }))}>Email {sort.key==='email' ? (sort.dir==='asc'?'↑':'↓'):''}</th>
            <th className="p-2 border">Phone</th>
          </tr>
        </thead>
        <tbody>
          {list.map(c=> (
            <tr key={c.id}>
              <td className="p-2 border">{c.code||''}</td>
              <td className="p-2 border">{c.name}</td>
              <td className="p-2 border">{c.email||''}</td>
              <td className="p-2 border">{c.phone||''}</td>
              <td className="p-2 border text-right">
                <button className="text-sm text-teal-700 mr-2" onClick={()=>setEditing(c)}>Edit</button>
                <button className="text-sm text-red-700" onClick={async()=>{ if(confirm('Delete customer?')){ try{ await api(`/customers/${c.id}`, { method: 'DELETE' }); load(); }catch(e:any){ setError(e.message||'Failed'); } } }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white p-4 rounded shadow w-full max-w-lg">
            <h2 className="font-semibold mb-3">Edit Customer</h2>
            <form onSubmit={async (e)=>{ e.preventDefault(); try{ await api(`/customers/${editing.id}`, { method:'PUT', body: JSON.stringify(editing) }); setEditing(null); setEditErrors({}); load(); }catch(e:any){ setError(e.message||'Failed'); setEditErrors(e.errors||{}); } }} className="space-y-2">
              <div>
                <input className="border rounded px-2 py-1 w-full" value={editing.code||''} onChange={e=>setEditing({...editing, code:e.target.value})} placeholder="Code"/>
                {editErrors.code && <p className="text-xs text-red-600">{editErrors.code.join(', ')}</p>}
              </div>
              <div>
                <input required className="border rounded px-2 py-1 w-full" value={editing.name||''} onChange={e=>setEditing({...editing, name:e.target.value})} placeholder="Name"/>
                {editErrors.name && <p className="text-xs text-red-600">{editErrors.name.join(', ')}</p>}
              </div>
              <div>
                <input className="border rounded px-2 py-1 w-full" value={editing.email||''} onChange={e=>setEditing({...editing, email:e.target.value})} placeholder="Email"/>
                {editErrors.email && <p className="text-xs text-red-600">{editErrors.email.join(', ')}</p>}
              </div>
              <div>
                <input className="border rounded px-2 py-1 w-full" value={editing.phone||''} onChange={e=>setEditing({...editing, phone:e.target.value})} placeholder="Phone"/>
                {editErrors.phone && <p className="text-xs text-red-600">{editErrors.phone.join(', ')}</p>}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setEditing(null)} className="px-3 py-1">Cancel</button>
                <button className="bg-teal-600 text-white px-3 py-1 rounded">Save</button>
              </div>
            </form>
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
