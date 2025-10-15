"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

type Org = { id: number; name: string };

export default function OrgSwitcher() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const orgId = localStorage.getItem("org_id");
    setCurrent(orgId);
    if (!token) return;
    fetch(`${API_BASE}/organizations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((data) => {
        const list: Org[] = Array.isArray(data?.data) ? data.data : data; // supports pagination or array
        setOrgs(list);
      })
      .catch(() => {});
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setCurrent(id);
    localStorage.setItem("org_id", id);
    // soft reload current page to refetch data with header
    window.location.reload();
  };

  return (
    <select
      className="border rounded px-2 py-1 text-sm"
      value={current ?? ''}
      onChange={onChange}
    >
      <option value="">Select Org</option>
      {orgs.map((o) => (
        <option key={o.id} value={String(o.id)}>{o.name}</option>
      ))}
    </select>
  );
}
