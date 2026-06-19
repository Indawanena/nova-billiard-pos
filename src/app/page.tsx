import {
  CircleDollarSign,
  Clock,
  Coffee,
  LayoutDashboard,
  LogOut,
  MonitorPlay,
  Play,
  Settings,
  SquareTerminal,
  Table2,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { SessionStatus, TableStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/money";
import { checkoutTableSession, startTableSession } from "./actions";

export default async function POSDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [tables, activeCount, productCount, todayPayments] = await Promise.all([
    prisma.billiardTable.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        sessions: {
          where: { status: SessionStatus.ACTIVE },
          orderBy: { startedAt: "desc" },
          take: 1,
          include: { orders: true },
        },
      },
    }),
    prisma.tableSession.count({ where: { status: SessionStatus.ACTIVE } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
  ]);

  const totalRevenue = Number(todayPayments._sum.amount ?? 0);
  const stats = [
    { label: "Meja Aktif", value: `${activeCount}/${tables.length}`, icon: Table2, active: activeCount > 0 },
    { label: "Produk F&B", value: String(productCount), icon: Coffee, active: productCount > 0 },
    { label: "User Login", value: session.user.name ?? "Kasir", icon: Users, active: false },
    { label: "Omzet", value: formatRupiah(totalRevenue), icon: CircleDollarSign, active: totalRevenue > 0 },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#020617] font-sans text-slate-50 selection:bg-emerald-500/30">
      <aside className="flex w-20 flex-col items-center border-r border-slate-800/60 bg-[#0F172A]/50 py-6 sm:w-64 sm:items-start sm:px-4">
        <div className="mb-10 flex w-full items-center justify-center gap-3 sm:justify-start sm:px-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500 text-[#020617] shadow-[0_0_15px_rgba(34,197,94,0.3)]">
            <MonitorPlay className="size-6" />
          </div>
          <span className="hidden text-xl font-bold tracking-tight sm:block">Nova<span className="text-emerald-400">POS</span></span>
        </div>

        <nav className="flex w-full flex-col gap-2">
          <NavItem icon={LayoutDashboard} label="Dashboard" active />
          <NavItem icon={Table2} label="Manajemen Meja" />
          <NavItem icon={Coffee} label="F&B Order" />
          <NavItem icon={SquareTerminal} label="Transaksi" />
          <NavItem icon={Settings} label="Pengaturan" />
        </nav>

        <div className="mt-auto flex w-full flex-col gap-2">
          <NavItem icon={LogOut} label="Keluar Sesi" variant="danger" />
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-20 items-center justify-between border-b border-slate-800/60 bg-[#020617]/50 px-8 backdrop-blur-md">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Ringkasan Shift</h1>
            <p className="text-sm text-slate-400">Data live dari Supabase • Node runtime</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium">{session.user.name}</span>
              <span className="text-xs text-emerald-400">{session.user.role}</span>
            </div>
            <div className="size-10 rounded-full border border-slate-700 bg-slate-800" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="border-slate-800 bg-[#0F172A]/80 shadow-none transition-colors duration-200 hover:bg-[#0F172A]">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className={`flex size-12 items-center justify-center rounded-full ${stat.active ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
                      <Icon className="size-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                      <p className="text-2xl font-semibold tabular-nums text-slate-100">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Status Meja</h2>
            <div className="flex gap-3">
              <Legend color="bg-emerald-500" label="Aktif" />
              <Legend color="bg-slate-600" label="Kosong" />
              <Legend color="bg-red-500/80" label="MT" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tables.map((table) => {
              const activeSession = table.sessions[0];
              const isActive = table.status === TableStatus.OCCUPIED && activeSession;
              const isMaintenance = table.status === TableStatus.MAINTENANCE;
              const minutes = activeSession ? Math.max(1, Math.ceil((Date.now() - activeSession.startedAt.getTime()) / 60000)) : 0;
              const tableAmount = activeSession ? Math.ceil((minutes / 60) * Number(table.hourlyRate)) : 0;
              const fnbAmount = activeSession?.orders.reduce((sum, order) => sum + Number(order.subtotal), 0) ?? 0;

              return (
                <Card
                  key={table.id}
                  className={`group relative flex flex-col overflow-hidden border transition-colors duration-200 ${
                    isActive
                      ? "border-emerald-500/30 bg-[#0F172A] shadow-[0_0_20px_rgba(34,197,94,0.05)] hover:border-emerald-500/50"
                      : isMaintenance
                        ? "border-red-900/30 bg-[#0F172A]/40 opacity-70"
                        : "border-slate-800 bg-[#0F172A]/60 hover:border-slate-700"
                  }`}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-bold text-slate-200">{table.name}</CardTitle>
                    {isActive ? (
                      <span className="flex h-6 items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-400">
                        <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-emerald-500" /> Aktif
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500">{isMaintenance ? "Maintenance" : "Tersedia"}</span>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1 pb-4">
                    <div className="mb-4 flex items-center gap-2 text-slate-400">
                      <Clock className="size-4" />
                      <span className={`font-mono text-xl font-medium tabular-nums tracking-tight ${isActive ? "text-slate-200" : "text-slate-600"}`}>
                        {isActive ? `${minutes} menit` : "00:00"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <Row label="Biliar" value={isActive ? formatRupiah(tableAmount) : "-"} active={Boolean(isActive)} />
                      {isActive ? <Row label="F&B" value={formatRupiah(fnbAmount)} active /> : null}
                      <Row label="Rate / Jam" value={formatRupiah(Number(table.hourlyRate))} active={false} />
                    </div>
                  </CardContent>

                  <CardFooter className="border-t border-slate-800/60 bg-slate-900/20 pt-2">
                    {isActive ? (
                      <div className="grid w-full grid-cols-2 gap-2">
                        <Button variant="outline" className="h-9 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white">F&B</Button>
                        <form action={checkoutTableSession}>
                          <input type="hidden" name="sessionId" value={activeSession.id} />
                          <Button className="h-9 w-full bg-emerald-500 text-[#020617] hover:bg-emerald-400">Checkout</Button>
                        </form>
                      </div>
                    ) : isMaintenance ? (
                      <Button disabled variant="outline" className="h-9 w-full border-slate-800 text-slate-600">Sedang Perbaikan</Button>
                    ) : (
                      <form action={startTableSession} className="w-full">
                        <input type="hidden" name="tableId" value={table.id} />
                        <Button className="h-9 w-full bg-slate-800 text-slate-200 hover:bg-slate-700">
                          <Play className="mr-2 size-4" /> Buka Meja
                        </Button>
                      </form>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-2 text-xs font-medium text-slate-400"><div className={`size-2 rounded-full ${color}`} /> {label}</div>;
}

function Row({ label, value, active }: { label: string; value: string; active: boolean }) {
  return <div className="flex justify-between text-sm"><span className="text-slate-500">{label}</span><span className={`font-medium tabular-nums ${active ? "text-slate-300" : "text-slate-600"}`}>{value}</span></div>;
}

function NavItem({ icon: Icon, label, active, variant = "default" }: { icon: any; label: string; active?: boolean; variant?: "default" | "danger" }) {
  const isDanger = variant === "danger";

  return (
    <button
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200 sm:px-4 ${
        active
          ? "bg-emerald-500/10 text-emerald-400"
          : isDanger
            ? "text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
      }`}
    >
      <Icon className={`size-5 shrink-0 ${active ? "text-emerald-400" : isDanger ? "group-hover:text-red-400" : "text-slate-500 group-hover:text-slate-300"}`} />
      <span className="hidden text-sm font-medium sm:block">{label}</span>
    </button>
  );
}
