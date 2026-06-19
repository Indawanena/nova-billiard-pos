"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-5"
      action={async (formData) => {
        setError("");
        setLoading(true);

        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.get("email"),
              password: formData.get("password"),
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            setError(data.error ?? "Login gagal.");
            setLoading(false);
            return;
          }

          window.location.href = "/";
        } catch {
          setError("Terjadi kesalahan.");
          setLoading(false);
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue="admin@nova.test"
          className="border-slate-700 bg-slate-950 text-slate-100"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue="admin12345"
          className="border-slate-700 bg-slate-950 text-slate-100"
          required
        />
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <Button type="submit" disabled={loading} className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">
        {loading ? "Masuk..." : "Masuk Dashboard"}
      </Button>
    </form>
  );
}
