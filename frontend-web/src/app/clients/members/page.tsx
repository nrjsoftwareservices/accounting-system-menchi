"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { useAuthRequired } from "@/lib/useAuth";

type Member = { id:number; name:string; email:string; pivot?: { role?: string } };
type Staff = { id:number; name:string; email:string };

const ROLES = ["admin","accountant","manager","clerk"] as const;

export default function ClientMembersPage() {
  useAuthRequired();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ user_id?: number; role?: string }>({});

  useEffect(()=>{ setOrgId(localStorage.getItem('org_id')); }, []);

  const authHeaders = () => {
    const token = localStorage.getItem('token') || '';
    return { Authorization: `Bearer ${token}`, 'X-Org-Id': String(orgId||'') } as Record<string,string>;
  };

  const load = () => {
    if (!orgId) return;
    Promise.all([
      fetch(`${API_BASE}/organizations/${orgId}/members`, { headers: authHeaders() }).then(r=>r.json()),
      fetch(`${API_BASE}/admin/users`, { headers: authHeaders() }).then(r=>r.json()),
    ]).then(([m, s])=>{
      setMembers(Array.isArray(m?.data)? m.data : m);
      setStaff(Array.isArray(s?.data)? s.data : s);
    }).catch(async e=> setError(String(e)));
  };

  useEffect(()=>{ load(); }, [orgId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!form.user_id || !form.role || !orgId) return;
    const res = await fetch(`${API_BASE}/organizations/${orgId}/members`, {
      method:'POST', headers: { 'Content-Type':'application/json', ...authHeaders() }, body: JSON.stringify(form)
    });
    if (!res.ok) { const t = await res.text(); setError(t); return; }
    setForm({}); load();
  };

  const updateRole = async (userId:number, role:string) => {
    if (!orgId) return;
    const res = await fetch(`${API_BASE}/organizations/${orgId}/members/${userId}`, { method:'PUT', headers: { 'Content-Type':'application/json', ...authHeaders() }, body: JSON.stringify({ role }) });
    if (!res.ok) { setError(await res.text()); } else { load(); }
  };
  const remove = async (userId:number) => {
    if (!orgId) return;
    const res = await fetch(`${API_BASE}/organizations/${orgId}/members/${userId}`, { method:'DELETE', headers: authHeaders() });
    if (!res.ok) { setError(await res.text()); } else { load(); }
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-2">Client Members</h1>
      <p className="text-xs text-gray-600 mb-4">Manages team access for the selected client (Org ID: {orgId || 'not selected'}). Use the Org switcher in the header to select a client.</p>
      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}

      <form onSubmit={add} className="border rounded p-3 mb-4 grid grid-cols-3 gap-2 text-sm">
        <select value={form.user_id||''} onChange={e=>setForm({...form, user_id:Number(e.target.value)})} className="border rounded px-2 py-1">
          <option value="">Select staff</option>
          {staff.map(u=> <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
        </select>
        <select value={form.role||''} onChange={e=>setForm({...form, role:e.target.value})} className="border rounded px-2 py-1">
          <option value="">Role</option>
          {ROLES.map(r=> <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="flex justify-end"><button className="bg-teal-600 text-white px-3 py-1 rounded">Add Member</button></div>
      </form>

      <table className="w-full border text-sm">
        <thead><tr className="bg-gray-50"><th className="p-2 border">Name</th><th className="p-2 border">Email</th><th className="p-2 border">Role</th><th className="p-2 border"></th></tr></thead>
        <tbody>
          {members.map(m=> (
            <tr key={m.id}>
              <td className="p-2 border">{m.name}</td>
              <td className="p-2 border">{m.email}</td>
              <td className="p-2 border">
                <select value={m.pivot?.role||''} onChange={e=>updateRole(m.id, e.target.value)} className="border rounded px-1 py-1">
                  {ROLES.map(r=> <option key={`${m.id}-${r}`} value={r}>{r}</option>)}
                </select>
              </td>
              <td className="p-2 border text-right"><button className="text-red-700 underline" onClick={()=>remove(m.id)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

