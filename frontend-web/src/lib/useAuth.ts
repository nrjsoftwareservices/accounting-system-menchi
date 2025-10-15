"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useAuthRequired() {
  const router = useRouter();
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) router.replace('/login');
  }, [router]);
}

