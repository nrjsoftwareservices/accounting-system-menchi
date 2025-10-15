"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export default function RoleBadge() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('token');
    const org = localStorage.getItem('org_id');
    if (!token || !org) return;
    fetch(`${API_BASE}/organizations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r=>r.json())
      .then(data => {
        const list = Array.isArray(data?.data) ? data.data : data;
        const current = list.find((o:any)=> String(o.id) === String(org));
        setRole(current?.pivot?.role || null);
      })
      .catch(()=>{});
  }, []);
  if (!role) return null;
  return (
    <span className="text-xs px-2 py-1 rounded bg-gray-100 border">Role: <span className="font-medium">{role}</span></span>
  );
}

