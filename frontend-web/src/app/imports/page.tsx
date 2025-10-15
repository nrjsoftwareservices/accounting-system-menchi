"use client";
import { useState } from "react";
import { API_BASE } from "@/lib/api";
import { useAuthRequired } from "@/lib/useAuth";

export default function ImportsPage() {
  useAuthRequired();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Mapping is defined per client in Clients settings; no need to collect here.

  const upload = async (endpoint: string, file: File | null) => {
    if (!file) return;
    setMsg(null); setErr(null);
    const token = localStorage.getItem('token');
    const org = localStorage.getItem('org_id') || '';
    const fd = new FormData();
    fd.append('file', file);
    // No additional mapping here; server reads from organization settings
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token||''}`, 'X-Org-Id': org },
        body: fd,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      setMsg(text);
    } catch (e:any) { setErr(e.message || 'Upload failed'); }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">CSV Imports</h1>
      {msg && <p className="text-green-700 text-sm mb-2">{msg}</p>}
      {err && <p className="text-red-700 text-sm mb-2">{err}</p>}
      <div className="space-y-6">
        <div className="border rounded p-3">
          <h2 className="font-medium mb-2">Accounts</h2>
          <p className="text-xs text-gray-600 mb-2">Columns: <b>code</b>, <b>name</b>, <b>type</b> (asset|liability|equity|revenue|expense|contra_asset|contra_liability|contra_equity|other), <b>parent_code</b> (optional)</p>
          <a className="text-sm text-teal-700 underline" href="/samples/accounts.csv" download>Download sample CSV</a>
          <input type="file" accept=".csv,text/csv" onChange={(e)=>upload('/imports/accounts', e.target.files?.[0]||null)} />
        </div>
        <div className="border rounded p-3">
          <h2 className="font-medium mb-2">Sales</h2>
          <a className="text-sm text-teal-700 underline" href="/samples/Sales-2025.csv" download>Download sales sample (your format name)</a>
          <p className="text-xs text-gray-600 mt-2">Account mappings are taken from the selected Client settings. Manage at <a className="underline" href="/clients">Clients</a>.</p>
          <p className="text-xs text-gray-600 mt-1">Optional override columns (when present in the CSV) take precedence per row: <code>AR ACCOUNT CODE</code>, <code>VAT PAYABLE ACCOUNT CODE</code>, <code>SALES GOODS ACCOUNT CODE</code>, <code>SALES SERVICES ACCOUNT CODE</code>, <code>SALES EXEMPT ACCOUNT CODE</code>, <code>SALES DISCOUNT ACCOUNT CODE</code>.</p>
          <div className="mt-2">
            <input type="file" accept=".csv,text/csv" onChange={(e)=>upload('/imports/journals?format=sales', e.target.files?.[0]||null)} />
          </div>
        </div>

        <div className="border rounded p-3">
          <h2 className="font-medium mb-2">Purchases & Expenses</h2>
          <div className="mb-2">
            <a className="text-sm text-teal-700 underline" href="/samples/P AND E CSV.csv" download>
              Download purchases & expenses sample
            </a>
          </div>
          <p className="text-xs text-gray-600 mb-2">Account mappings are taken from the selected Client settings. Manage at <a className="underline" href="/clients">Clients</a>. Optional override columns: <code>CREDIT ACCOUNT CODE</code>, <code>CASH ACCOUNT CODE</code>, <code>INPUT VAT ACCOUNT CODE</code>, <code>EXPENSE VATABLE ACCOUNT CODE</code>, <code>EXPENSE NON VAT ACCOUNT CODE</code>, <code>DEFAULT EXPENSE ACCOUNT CODE</code>.</p>
          <div>
            <input type="file" accept=".csv,text/csv" onChange={(e)=>upload('/imports/purchases', e.target.files?.[0]||null)} />
          </div>
        </div>
      </div>
    </div>
  );
}
