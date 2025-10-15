"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { useAuthRequired } from "@/lib/useAuth";

type Staff = { id:number; name:string; email:string; created_at:string };

export default function StaffPage() {
  useAuthRequired();
  const [list, setList] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState<{name:string; email:string; password:string}>({ name:'', email:'', password:'' });
  const [creating, setCreating] = useState(false);

  const load = () => {
    const token = localStorage.getItem('token');
    const org = localStorage.getItem('org_id') || '';
    fetch(`${API_BASE}/admin/users?page=${page}`, { headers: { Authorization: `Bearer ${token||''}`, 'X-Org-Id': org } })
      .then(async r=> r.ok? r.json(): Promise.reject(await r.text()))
      .then(data=>{
        setList(Array.isArray(data?.data)? data.data : data);
        setPage(data.current_page||1); setLastPage(data.last_page||1); setTotal(data.total||data.data?.length||0);
      })
      .catch(e=> setError(String(e)));
  };
  useEffect(()=>{ load(); }, [page]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setCreating(true);
    try {
      const token = localStorage.getItem('token');
      const org = localStorage.getItem('org_id') || '';
      const res = await fetch(`${API_BASE}/admin/users`, {
        method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token||''}`, 'X-Org-Id': org }, body: JSON.stringify(form)
      });
      const payload = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(payload?.message || res.statusText);
      setForm({ name:'', email:'', password:'' });
      load();
    } catch(e:any) {
      setError(e.message||'Failed');
    } finally { setCreating(false); }
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Staff</h1>
      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
      <form onSubmit={create} className="border rounded p-3 mb-6 grid grid-cols-3 gap-2 text-sm">
        <input required placeholder="Full name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="border rounded px-2 py-1" />
        <input required type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} className="border rounded px-2 py-1" />
        <input required type="password" placeholder="Temp password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="border rounded px-2 py-1" />
        <div className="col-span-3 flex justify-end"><button disabled={creating} className={`px-3 py-1 rounded ${creating? 'opacity-50 border':'bg-teal-600 text-white'}`}>Create User</button></div>
      </form>
      <table className="w-full border text-sm">
        <thead><tr className="bg-gray-50"><th className="p-2 border">Name</th><th className="p-2 border">Email</th><th className="p-2 border">Created</th></tr></thead>
        <tbody>
          {list.map(u=> (
            <tr key={u.id}>
              <td className="p-2 border">{u.name}</td>
              <td className="p-2 border">{u.email}</td>
              <td className="p-2 border">{u.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between mt-2 text-sm">
        <div>Total: {total}</div>
        <div className="flex items-center gap-1">
          <button disabled={page<=1} onClick={()=>setPage(Math.max(1,page-1))} className={`px-2 py-1 border rounded ${page<=1?'opacity-50':''}`}>Prev</button>
          <span className="px-2">{page}/{lastPage}</span>
          <button disabled={page>=lastPage} onClick={()=>setPage(Math.min(lastPage,page+1))} className={`px-2 py-1 border rounded ${page>=lastPage?'opacity-50':''}`}>Next</button>
        </div>
      </div>
    </div>
  );
}

