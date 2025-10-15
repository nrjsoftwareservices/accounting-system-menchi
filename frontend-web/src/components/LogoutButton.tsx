"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const router = useRouter();
  const onLogout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("org_id");
    } catch {}
    router.push("/login");
  };
  return (
    <Button variant="outline" size="sm" onClick={onLogout} title="Log out">
      Logout
    </Button>
  );
}

