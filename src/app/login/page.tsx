import { MonitorPlay } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-slate-50">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0F172A]/90 p-8 shadow-2xl shadow-emerald-950/20">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500 text-[#020617]">
            <MonitorPlay className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">NovaPOS Login</h1>
            <p className="text-sm text-slate-400">Masuk ke shift kasir.</p>
          </div>
        </div>
        <LoginForm />
        <p className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400">
          Demo seed: <span className="text-slate-200">admin@nova.test</span> / <span className="text-slate-200">admin12345</span>
        </p>
      </section>
    </main>
  );
}
