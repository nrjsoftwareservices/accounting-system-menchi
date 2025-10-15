"use client";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";
import { useAuthRequired } from "@/lib/useAuth";

export default function ContactsPage() {
  useAuthRequired();
  const [customers, setCustomers] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [qC, setQC] = useState("");
  const [qS, setQS] = useState("");

  const load = () => {
    const token = localStorage.getItem('token');
    const org = localStorage.getItem('org_id') || '';
    fetch(`${API_BASE}/reports/contacts`, { headers: { Authorization: `Bearer ${token||''}`, 'X-Org-Id': org } })
      .then(async r => r.ok? r.json(): Promise.reject(await r.text()))
      .then(data => { setCustomers(data.customers||[]); setSuppliers(data.suppliers||[]); })
      .catch(e => setError(String(e)));
  };
  useEffect(()=>{ load(); }, []);

  const filteredC = useMemo(() => customers.filter(n => n.toLowerCase().includes(qC.toLowerCase())), [customers, qC]);
  const filteredS = useMemo(() => suppliers.filter(n => n.toLowerCase().includes(qS.toLowerCase())), [suppliers, qS]);

  const exportUrl = (type: 'customers'|'suppliers') => {
    const token = localStorage.getItem('token');
    const org = localStorage.getItem('org_id') || '';
    return `${API_BASE}/exports/contacts/${type}?t=${Date.now()}`;
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Contacts</h1>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-2 gap-6">
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Customers</h2>
            <a className="text-sm underline" href="/api/v1/exports/contacts/customers" target="_blank" rel="noreferrer">Export CSV</a>
          </div>
          <input value={qC} onChange={e=>setQC(e.target.value)} placeholder="Filter" className="border rounded px-2 py-1 text-sm w-full mb-2" />
          <div className="border rounded p-2 h-80 overflow-auto text-sm bg-card">
            {filteredC.map((n,i)=> <div key={i} className="py-0.5">{n}</div>)}
            {filteredC.length===0 && <div className="text-muted-foreground">No customers found.</div>}
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Suppliers</h2>
            <a className="text-sm underline" href="/api/v1/exports/contacts/suppliers" target="_blank" rel="noreferrer">Export CSV</a>
          </div>
          <input value={qS} onChange={e=>setQS(e.target.value)} placeholder="Filter" className="border rounded px-2 py-1 text-sm w-full mb-2" />
          <div className="border rounded p-2 h-80 overflow-auto text-sm bg-card">
            {filteredS.map((n,i)=> <div key={i} className="py-0.5">{n}</div>)}
            {filteredS.length===0 && <div className="text-muted-foreground">No suppliers found.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

