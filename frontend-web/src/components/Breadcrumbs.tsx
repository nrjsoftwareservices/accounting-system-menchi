"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Breadcrumbs() {
  const pathname = usePathname() || "/";
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((p, i) => ({
    label: p[0]?.toUpperCase() + p.slice(1),
    href: "/" + parts.slice(0, i + 1).join("/"),
  }));
  return (
    <div className="text-xs text-gray-600 mb-3">
      <Link href="/" className="hover:underline">Home</Link>
      {crumbs.map((c, i) => (
        <span key={c.href}>
          <span className="mx-1">/</span>
          {i === crumbs.length - 1 ? (
            <span className="text-gray-900">{c.label}</span>
          ) : (
            <Link href={c.href} className="hover:underline">{c.label}</Link>
          )}
        </span>
      ))}
    </div>
  );
}

