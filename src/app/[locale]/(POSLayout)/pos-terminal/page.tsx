"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  IconShoppingCart,
  IconPlus,
  IconMinus,
  IconReceipt,
  IconClock,
  IconLogout,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconSearch,
  IconPlayerPlay,
  IconArrowLeft,
  IconMenu2,
  IconLayoutGrid,
  IconReportMoney,
  IconUserCircle,
  IconSunrise,
  IconClockHour4,
  IconTool,
  IconDots,
  IconBell,
  IconPrinter,
  IconCash,
  IconHourglass,
  IconRefresh,
  IconMaximize,
  IconExternalLink,
  IconCalendarStats,
  IconCoin,
  IconReceipt2,
  IconClipboardList,
} from "@tabler/icons-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { calculateTax, formatTaxLabel, type TaxSettings } from "@/lib/tax";

// ─── Types ───────────────────────────────────────────────────────────────────
interface FnbCategory { id: number; name: string; description: string; isActive: boolean; }
interface FnbItem { id: number; name: string; description: string; price: string; cost: string; stockQuantity: number; minStockLevel: number; unit: string; isActive: boolean; categoryId: number; categoryName: string; }
interface CartItem { id: number; name: string; price: string; quantity: number; unit: string; }
interface PricingPackageInfo { id: string; name: string; category: string; hourlyRate: string; perMinuteRate: string; }
interface Table {
  id: number; name: string; status: string; customerName?: string; pricingPackageId?: string;
  pricingPackage?: { id: string; name: string; description: string; category: string; hourlyRate: string; perMinuteRate: string; isDefault: boolean; isActive: boolean; };
}
interface ActiveSession { id: number; tableId: number; customerName: string; startTime: string; plannedDuration: number; durationType: string; fnbOrderCount: number; pricingPackage: PricingPackageInfo | null; }
interface PricingPackage { id: string; name: string; description: string; category: string; hourlyRate: string; perMinuteRate: string; isDefault: boolean; isActive: boolean; }
interface Staff { id: number; name: string; role: string; isActive: boolean; }
interface DraftOrder { id: number; orderNumber: string; customerName: string; total: string; itemCount: number; createdAt: string; notes?: string; }
interface PaymentMethodOption { id: string; label: string; enabled: boolean; }
interface ExistingOrderItem { id: number; itemName: string; quantity: number; unitPrice: string; subtotal: string; }
interface ExistingOrder { id: number; orderNumber: string; total: string; status: string; notes?: string; items: ExistingOrderItem[]; }
interface PaymentRecord {
  id: number; transactionNumber: string; customerName?: string; tableAmount: string; fnbAmount: string;
  taxAmount: string; totalAmount: string; paymentMethods?: string; paymentMethod?: string; status: string; createdAt: string;
}
interface DailyStats {
  period: { startDate: string; endDate: string; days: number };
  tables: { totalTables: number; activeTables: number; availableTables: number };
  sessions: { totalSessions: number; completedSessions: number; activeSessions: number; avgDuration: number; totalRevenue: number };
  fnb: { totalOrders: number; totalRevenue: number; avgOrderValue: number };
  dailyBreakdown: { date: string; sessions: number; revenue: number; avgDuration: number }[];
}
interface BillingPreview {
  sessionId: number; tableId: number; customerName: string; customerPhone?: string; staffId?: number;
  actualDuration: number; billingDetails: { type: string; rate: number; billableHours?: number; billableMinutes?: number; packageName?: string };
  tableCost: number; fnbTotalCost: number; subtotal: number; tableTax: number; fnbTax: number; totalTaxAmount: number; totalCost: number;
  fnbOrders: { id: number; total: string; items: ExistingOrderItem[] }[];
}

type Module = "tables" | "sales-recap" | "shift-log" | "day-start-end" | "tools" | "others";
type OrderFlow = "list" | "order" | "payment";

// ─── Component ───────────────────────────────────────────────────────────────
const POSTerminal = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Data
  const [categories, setCategories] = useState<FnbCategory[]>([]);
  const [items, setItems] = useState<FnbItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [draftOrders, setDraftOrders] = useState<DraftOrder[]>([]);
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<PaymentMethodOption[]>([]);
  const [pricingPackages, setPricingPackages] = useState<PricingPackage[]>([]);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({ enabled: false, percentage: 11, name: "PPN", applyToTables: false, applyToFnb: true });

  // UI
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<Module>("tables");
  const [orderFlow, setOrderFlow] = useState<OrderFlow>("list");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [serviceMode, setServiceMode] = useState<"quick" | "dinein">("dinein");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [orderContext, setOrderContext] = useState<"standalone" | "table_session">("standalone");
  const [existingOrders, setExistingOrders] = useState<ExistingOrder[]>([]);
  const [billingPreview, setBillingPreview] = useState<BillingPreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // Report data (Sales Recap / Shift Log / Day Start-End)
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Table activation
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activateTableId, setActivateTableId] = useState<number | null>(null);
  const [activateCustomerName, setActivateCustomerName] = useState("");
  const [activatePackageId, setActivatePackageId] = useState("");

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (status === "unauthenticated") router.push("/auth/signin"); }, [status, router]);

  const fetchData = useCallback(async () => {
    try {
      const [catRes, itemRes, tableRes, sessRes, staffRes, draftRes, taxRes, payRes, pricingRes] = await Promise.all([
        fetch("/api/fnb/categories"), fetch("/api/fnb/items"), fetch("/api/tables"), fetch("/api/table-sessions/active"),
        fetch("/api/staff"), fetch("/api/fnb/orders/drafts"), fetch("/api/settings/tax"),
        fetch("/api/settings/payment-methods"), fetch("/api/pricing-packages?isActive=true"),
      ]);
      if (taxRes.ok) setTaxSettings(await taxRes.json());
      if (payRes.ok) { const d = await payRes.json(); const m = (d.methods||[]).filter((x:PaymentMethodOption)=>x.enabled); setPaymentMethodOptions(m); if(m.length>0) setSelectedPaymentMethod(m[0].id); }
      if (catRes.ok) setCategories(await catRes.json());
      if (itemRes.ok) setItems(await itemRes.json());
      if (tableRes.ok) setTables(await tableRes.json());
      if (sessRes.ok) setActiveSessions(await sessRes.json());
      if (staffRes.ok) setStaff(await staffRes.json());
      if (draftRes.ok) setDraftOrders(await draftRes.json());
      if (pricingRes.ok) setPricingPackages(await pricingRes.json());
    } catch { showAlertMsg("error", "Gagal memuat data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (session) fetchData(); }, [session, fetchData]);

  // Fetch report data for Sales Recap / Shift Log / Day Start-End modules
  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const [statsRes, payRes] = await Promise.all([
        fetch(`/api/analytics/daily-stats?date=${today}&days=7`),
        fetch(`/api/payments?status=success`),
      ]);
      if (statsRes.ok) setDailyStats(await statsRes.json());
      if (payRes.ok) setPayments(await payRes.json());
    } catch { showAlertMsg("error", "Gagal memuat laporan"); }
    finally { setReportLoading(false); }
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const showAlertMsg = (type: "success"|"error", message: string) => { setAlert({type,message}); setTimeout(()=>setAlert(null),4000); };
  const formatCurrency = (n: number) => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",minimumFractionDigits:0}).format(n);
  const cartSubtotal = () => cart.reduce((s,i) => s + parseFloat(i.price)*i.quantity, 0);
  const totalItems = cart.reduce((s,i) => s + i.quantity, 0);

  // Elapsed time (seconds) since session start
  const getElapsedSeconds = (startTime: string) => Math.max(0, Math.floor((currentTime.getTime() - new Date(startTime).getTime()) / 1000));
  const formatDuration = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };
  // Running billiard cost (matches end-session logic)
  const computeTableCost = (sess: ActiveSession) => {
    const pkg = sess.pricingPackage;
    const totalSec = getElapsedSeconds(sess.startTime);
    if (!pkg) return 0;
    if (pkg.category === "per_minute") {
      const rate = parseFloat(pkg.perMinuteRate || "0");
      const minutes = Math.floor(totalSec / 60), remSec = totalSec % 60;
      const billable = remSec > 30 ? minutes + 1 : minutes;
      return billable * rate;
    } else {
      const rate = parseFloat(pkg.hourlyRate || "0");
      const billableHours = Math.max(1, Math.ceil(totalSec / 3600));
      return billableHours * rate;
    }
  };
  const sessionForTable = (tableId: number) => activeSessions.find(s => s.tableId === tableId);
  const existingFnbTotal = () => existingOrders.reduce((s, o) => s + parseFloat(o.total), 0);

  // ─── Cart ────────────────────────────────────────────────────────────────────
  const addToCart = (item: FnbItem) => {
    if (item.stockQuantity <= 0) { showAlertMsg("error","Item habis"); return; }
    const ex = cart.find(c=>c.id===item.id);
    if (ex) { if(ex.quantity>=item.stockQuantity){showAlertMsg("error","Stok tidak cukup");return;} setCart(cart.map(c=>c.id===item.id?{...c,quantity:c.quantity+1}:c)); }
    else { setCart([...cart,{id:item.id,name:item.name,price:item.price,quantity:1,unit:item.unit}]); }
  };
  const removeFromCart = (id: number) => setCart(cart.filter(c=>c.id!==id));
  const updateQuantity = (id: number, qty: number) => {
    if (qty<=0) return removeFromCart(id);
    const item = items.find(i=>i.id===id);
    if (item && qty > item.stockQuantity) { showAlertMsg("error","Stok tidak cukup"); return; }
    setCart(cart.map(c=>c.id===id?{...c,quantity:qty}:c));
  };

  const exitOrderFlow = () => {
    setCart([]); setSelectedTable(null); setOrderContext("standalone"); setCustomerName("");
    setOrderNotes(""); setSearchQuery(""); setActiveCategory(null); setExistingOrders([]);
    setBillingPreview(null); setAmountPaid(""); setOrderFlow("list"); setSidebarCollapsed(false);
  };

  // ─── Table / Order navigation ──────────────────────────────────────────────
  const loadTableOrders = async (tableId: number) => {
    try { const r = await fetch(`/api/tables/${tableId}/orders`); if (r.ok) setExistingOrders(await r.json()); }
    catch { /* ignore */ }
  };
  const enterOrder = async (table: Table | null) => {
    if (table) {
      setSelectedTable(table); setOrderContext("table_session");
      const sess = sessionForTable(table.id);
      if (sess?.customerName) setCustomerName(sess.customerName);
      else if (table.customerName) setCustomerName(table.customerName);
      setServiceMode("dinein");
      await loadTableOrders(table.id);
    } else {
      setSelectedTable(null); setOrderContext("standalone"); setCustomerName(""); setServiceMode("quick"); setExistingOrders([]);
    }
    setActiveCategory(null); setOrderFlow("order"); setSidebarCollapsed(true);
  };

  const openActivateTable = (tableId: number) => { setActivateTableId(tableId); setActivateCustomerName(""); setActivatePackageId(pricingPackages.length>0?pricingPackages[0].id:""); setShowActivateModal(true); };
  const activateTable = async () => {
    if (!activateTableId||!activateCustomerName.trim()||!activatePackageId) { showAlertMsg("error","Lengkapi data"); return; }
    try {
      const r = await fetch(`/api/tables/${activateTableId}/start-session`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customerName:activateCustomerName.trim(),mode:"open",pricingPackageId:activatePackageId})});
      if (r.ok) { showAlertMsg("success",`Meja aktif: ${activateCustomerName}`); setShowActivateModal(false); fetchData(); }
      else { const e=await r.json(); showAlertMsg("error",e.error||"Gagal"); }
    } catch { showAlertMsg("error","Gagal mengaktifkan meja"); }
  };

  // ─── SAVE ORDER (ESB: add F&B to running bill, stays open) ───────────────────
  const saveOrder = async () => {
    if (cart.length===0){showAlertMsg("error","Belum ada item");return;}
    if (!customerName.trim()){showAlertMsg("error","Nama pelanggan wajib");return;}
    const staffId = selectedStaffId || String(staff.find(s=>s.isActive)?.id || "");
    if (!staffId){showAlertMsg("error","Tidak ada kasir aktif");return;}

    const subtotal = cartSubtotal();
    const tax = calculateTax(subtotal, taxSettings, false);
    const total = subtotal + tax;
    setIsProcessing(true);
    try {
      const r = await fetch("/api/fnb/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        context: orderContext === "table_session" ? "table_session" : "standalone",
        customerName: customerName.trim(), customerPhone: null,
        tableId: selectedTable ? selectedTable.id : null, staffId: parseInt(staffId),
        subtotal: subtotal.toFixed(2), tax: tax.toFixed(2), total: total.toFixed(2), notes: orderNotes||null,
        paymentMethods: orderContext === "standalone" ? [{type:selectedPaymentMethod,amount:total.toFixed(2)}] : null,
        items: cart.map(i=>({itemId:i.id,quantity:i.quantity,unitPrice:i.price,subtotal:(parseFloat(i.price)*i.quantity).toFixed(2)})),
      })});
      if (r.ok) {
        const res = await r.json();
        if (orderContext === "table_session") {
          showAlertMsg("success", `Order ${res.orderNumber} ditambahkan ke tagihan ${selectedTable?.name}`);
          // ESB behaviour: after saving the order, return to the table list.
          exitOrderFlow();
          fetchData();
        } else {
          // Quick service: order created + payment auto-created (pending). Go settle in payment view.
          showAlertMsg("success", `Order ${res.orderNumber} disimpan`);
          exitOrderFlow();
          fetchData();
        }
      } else { const e=await r.json(); showAlertMsg("error",e.message||"Gagal menyimpan order"); }
    } catch { showAlertMsg("error","Gagal menyimpan order"); }
    finally { setIsProcessing(false); }
  };

  // ─── GO TO PAYMENT (ESB: end session + build consolidated bill) ──────────────
  const goToPayment = async () => {
    if (orderContext === "standalone") {
      if (cart.length===0){showAlertMsg("error","Belum ada item");return;}
      if (!customerName.trim()){showAlertMsg("error","Nama pelanggan wajib");return;}
      // Build local preview for quick service (cart only)
      const subtotal = cartSubtotal();
      const fnbTax = calculateTax(subtotal, taxSettings, false);
      setBillingPreview({
        sessionId: 0, tableId: 0, customerName: customerName.trim(),
        actualDuration: 0, billingDetails: { type: "none", rate: 0 },
        tableCost: 0, fnbTotalCost: subtotal, subtotal, tableTax: 0, fnbTax, totalTaxAmount: fnbTax, totalCost: subtotal + fnbTax,
        fnbOrders: [],
      });
      setAmountPaid("");
      setOrderFlow("payment");
      return;
    }

    // Dine-in: end the session to compute consolidated bill (time + all pending F&B + tax)
    if (!selectedTable) return;
    // Save any pending cart first
    if (cart.length > 0) {
      showAlertMsg("error", "Simpan order (Save Order) dulu sebelum bayar, atau kosongkan keranjang");
      return;
    }
    setIsProcessing(true);
    try {
      const r = await fetch(`/api/tables/${selectedTable.id}/end-session`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({}) });
      if (r.ok) {
        const data = await r.json();
        setBillingPreview(data.billing);
        setAmountPaid("");
        setOrderFlow("payment");
      } else { const e = await r.json(); showAlertMsg("error", e.error || "Gagal mengakhiri sesi"); }
    } catch { showAlertMsg("error", "Gagal mengakhiri sesi"); }
    finally { setIsProcessing(false); }
  };

  // ─── SAVE PAYMENT (ESB: create consolidated payment + settle) ────────────────
  const savePayment = async () => {
    if (!billingPreview) return;
    const staffId = selectedStaffId || String(staff.find(s=>s.isActive)?.id || "");
    if (!staffId){showAlertMsg("error","Pilih kasir");return;}
    setIsProcessing(true);
    try {
      if (orderContext === "standalone") {
        // Quick service: create the standalone order (auto-creates a pending payment), then settle it.
        const total = billingPreview.totalCost;
        const orderRes = await fetch("/api/fnb/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          context: "standalone", customerName: customerName.trim(), customerPhone: null, tableId: null, staffId: parseInt(staffId),
          subtotal: billingPreview.subtotal.toFixed(2), tax: billingPreview.totalTaxAmount.toFixed(2), total: total.toFixed(2),
          notes: orderNotes || null, paymentMethods: [{ type: selectedPaymentMethod, amount: total.toFixed(2) }],
          items: cart.map(i=>({itemId:i.id,quantity:i.quantity,unitPrice:i.price,subtotal:(parseFloat(i.price)*i.quantity).toFixed(2)})),
        })});
        if (!orderRes.ok) { const e = await orderRes.json(); showAlertMsg("error", e.message || "Gagal membuat order"); setIsProcessing(false); return; }
        const orderData = await orderRes.json();
        const paymentId = orderData.paymentRecord?.id;
        if (paymentId) {
          await fetch(`/api/payments/${paymentId}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ status: "success", paymentMethod: selectedPaymentMethod }) });
        }
        showAlertMsg("success", `Pembayaran berhasil! Order ${orderData.orderNumber}`);
        exitOrderFlow(); fetchData();
      } else {
        // Dine-in: create consolidated payment for the (already ended) session, then settle.
        const payRes = await fetch("/api/payments", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({
          sessionId: billingPreview.sessionId, tableId: billingPreview.tableId,
          customerName: billingPreview.customerName, customerPhone: billingPreview.customerPhone || null,
          tableAmount: billingPreview.tableCost.toFixed(2), fnbAmount: billingPreview.fnbTotalCost.toFixed(2),
          taxAmount: billingPreview.totalTaxAmount.toFixed(2), totalAmount: billingPreview.totalCost.toFixed(2),
          staffId: parseInt(staffId), paymentMethods: [{ type: selectedPaymentMethod, amount: billingPreview.totalCost.toFixed(2) }],
        })});
        if (!payRes.ok) { const e = await payRes.json(); showAlertMsg("error", e.error || "Gagal membuat pembayaran"); setIsProcessing(false); return; }
        const payData = await payRes.json();
        await fetch(`/api/payments/${payData.id}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ status: "success", paymentMethod: selectedPaymentMethod }) });
        showAlertMsg("success", `Pembayaran ${selectedTable?.name} berhasil!`);
        exitOrderFlow(); fetchData();
      }
    } catch { showAlertMsg("error", "Gagal memproses pembayaran"); }
    finally { setIsProcessing(false); }
  };

  // ─── Filtered ────────────────────────────────────────────────────────────────
  const filteredItems = items.filter(i => {
    const matchCat = activeCategory ? i.categoryId === activeCategory : true;
    const matchSearch = searchQuery ? i.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    return matchCat && matchSearch;
  });

  if (status==="loading"||loading) return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const catColors = ["#e74c3c","#f39c12","#27ae60","#3498db","#9b59b6","#1abc9c","#e67e22","#2ecc71","#e91e63","#00bcd4","#ff5722","#607d8b"];

  const sidebarItems: { key: Module; label: string; icon: typeof IconLayoutGrid }[] = [
    { key: "tables", label: "Table List", icon: IconLayoutGrid },
    { key: "sales-recap", label: "Sales Recapitulation", icon: IconReportMoney },
    { key: "shift-log", label: "Shift Log", icon: IconClockHour4 },
    { key: "day-start-end", label: "Day Start / End", icon: IconSunrise },
    { key: "tools", label: "Tools", icon: IconTool },
    { key: "others", label: "Others", icon: IconDots },
  ];
  const moduleLabels: Record<Module, string> = {
    "tables": "Table List", "sales-recap": "Sales Recapitulation",
    "shift-log": "Shift Log", "day-start-end": "Day Start / End", "tools": "Tools", "others": "Others",
  };
  const goToModule = (m: Module) => { setActiveModule(m); if (m !== "tables") exitOrderFlow(); if (m === "sales-recap" || m === "shift-log" || m === "day-start-end") fetchReport(); };

  // Today's settled payments (for Shift Log & Day Start/End)
  const todayStr = new Date().toDateString();
  const todayPayments = payments.filter(p => new Date(p.createdAt).toDateString() === todayStr);
  const todayTotal = todayPayments.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0);
  const todayTableTotal = todayPayments.reduce((s, p) => s + (Number(p.tableAmount) || 0), 0);
  const todayFnbTotal = todayPayments.reduce((s, p) => s + (Number(p.fnbAmount) || 0), 0);

  // Running bill total for dine-in order screen (live time + existing F&B + current cart)
  const liveSession = selectedTable ? sessionForTable(selectedTable.id) : undefined;
  const liveTableCost = liveSession ? computeTableCost(liveSession) : 0;
  const runningBillTotal = liveTableCost + existingFnbTotal() + cartSubtotal();

  const changeDue = billingPreview && amountPaid ? Math.max(0, parseFloat(amountPaid || "0") - billingPreview.totalCost) : 0;

  // Detect whether the selected payment method is cash (to show quick nominal buttons)
  const selectedMethodLabel = paymentMethodOptions.find(m => m.id === selectedPaymentMethod)?.label || selectedPaymentMethod;
  const isCashPayment = paymentMethodOptions.length === 0 || /cash|tunai/i.test(selectedMethodLabel) || /cash|tunai/i.test(selectedPaymentMethod);

  // Build quick cash nominal suggestions based on the bill total
  const quickCashOptions = (() => {
    if (!billingPreview) return [] as { label: string; value: number }[];
    const total = Math.ceil(billingPreview.totalCost);
    const opts: { label: string; value: number }[] = [{ label: "Uang Pas", value: total }];
    const seen = new Set<number>([total]);
    // Round up to common denominations
    for (const step of [5000, 10000, 20000, 50000, 100000]) {
      const rounded = Math.ceil(total / step) * step;
      if (rounded > total && !seen.has(rounded)) { seen.add(rounded); opts.push({ label: formatCurrency(rounded), value: rounded }); }
    }
    // Standard cash bills above the total
    for (const bill of [20000, 50000, 100000, 150000, 200000, 300000, 500000]) {
      if (bill > total && !seen.has(bill)) { seen.add(bill); opts.push({ label: formatCurrency(bill), value: bill }); }
    }
    return opts.sort((a, b) => a.value - b.value).slice(0, 6);
  })();

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden select-none">
      {/* ═══ TOP BAR ═══ */}
      <div className="h-12 bg-blue-700 flex items-center justify-between px-3 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={()=>setSidebarCollapsed(!sidebarCollapsed)} className="p-1.5 hover:bg-blue-600 rounded transition-colors"><IconMenu2 className="w-5 h-5" /></button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Synchronize</span>
            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">● Enable</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <IconBell className="w-4 h-4 text-blue-200" />
          <IconPrinter className="w-4 h-4 text-blue-200" />
          <span className="text-blue-50 flex items-center gap-1.5"><IconClock className="w-4 h-4" />{currentTime.toLocaleDateString("en-US",{weekday:"short",day:"numeric",month:"short",year:"numeric"})} {currentTime.toLocaleTimeString("en-GB")}</span>
          <span className="text-blue-50">🏠 {session?.user?.name || "Nova Billiard"}</span>
          <button onClick={()=>signOut({callbackUrl:"/auth/signin"})} className="text-blue-50 hover:text-white flex items-center gap-1"><IconLogout className="w-4 h-4" /> Sign Out</button>
          <IconUserCircle className="w-5 h-5 text-blue-200" />
        </div>
      </div>

      {alert && (
        <div className={`absolute top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-lg shadow-xl flex items-center gap-2 text-sm font-medium ${alert.type==="success"?"bg-green-600":"bg-red-600"} text-white`}>
          {alert.type==="success"?<IconCheck className="w-4 h-4"/>:<IconAlertCircle className="w-4 h-4"/>}{alert.message}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ═══ SIDEBAR ═══ */}
        <div className={`bg-gray-800 border-r border-gray-700 flex flex-col shrink-0 transition-all duration-200 ${sidebarCollapsed ? "w-14" : "w-60"}`}>
          <div className={`h-12 flex items-center border-b border-gray-700 shrink-0 ${sidebarCollapsed ? "justify-center" : "px-4"}`}>
            {sidebarCollapsed ? <span className="text-lg">🎱</span> : <span className="font-bold text-sm">🎱 Nova Billiard</span>}
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon; const isActive = activeModule === item.key;
              return (
                <button key={item.key} onClick={() => goToModule(item.key)} title={item.label}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${isActive ? "bg-gray-900 text-blue-400 border-l-2 border-blue-500" : "text-gray-400 hover:bg-gray-700 hover:text-white border-l-2 border-transparent"} ${sidebarCollapsed ? "justify-center px-0" : ""}`}>
                  <Icon className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
          {!sidebarCollapsed && <div className="p-3 border-t border-gray-700 text-[10px] text-gray-500"><p>v.1.0.0</p><p>Nova Billiard POS © 2026</p></div>}
        </div>

        {/* ═══ MAIN CONTENT ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">

          {/* ──────────── TABLE LIST ──────────── */}
          {activeModule === "tables" && orderFlow === "list" && (
            <div className="flex-1 flex flex-col p-5 overflow-hidden">
              <div className="flex gap-2 mb-4">
                <button onClick={()=>enterOrder(null)} className="px-6 py-2.5 font-semibold rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95">QUICK SERVICE</button>
                <button onClick={()=>setServiceMode("dinein")} className={`px-6 py-2.5 font-semibold rounded-lg text-sm transition-all ${serviceMode==="dinein"?"bg-blue-600 text-white":"bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>DINE IN</button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {tables.map((table) => {
                    const sess = sessionForTable(table.id);
                    let bg = "bg-blue-500 hover:bg-blue-400";
                    if (table.status === "occupied") bg = "bg-red-500 hover:bg-red-400";
                    else if (table.status === "reserved") bg = "bg-orange-500 hover:bg-orange-400";
                    else if (table.status === "maintenance") bg = "bg-gray-600 cursor-not-allowed";
                    return (
                      <button key={table.id}
                        onClick={() => { if (table.status==="occupied") enterOrder(table); else if (table.status==="available") openActivateTable(table.id); }}
                        disabled={table.status==="maintenance"}
                        className={`${bg} rounded-xl p-4 text-center text-white font-bold transition-all active:scale-95 min-h-[120px] flex flex-col items-center justify-center gap-1 shadow-md`}>
                        <span className="text-2xl">{table.name}</span>
                        {table.status === "occupied" && sess ? (
                          <>
                            <span className="text-[11px] font-normal opacity-90 truncate w-full px-1">{sess.customerName}</span>
                            <span className="flex items-center gap-1 text-sm font-mono font-bold mt-1 bg-black/20 px-2 py-0.5 rounded">
                              <IconHourglass className="w-3.5 h-3.5" />{formatDuration(getElapsedSeconds(sess.startTime))}
                            </span>
                            <span className="text-[10px] font-normal opacity-80 mt-0.5">{formatCurrency(computeTableCost(sess))}</span>
                            {sess.fnbOrderCount > 0 && <span className="text-[9px] font-normal opacity-70">🍽 {sess.fnbOrderCount} order</span>}
                          </>
                        ) : table.status === "available" ? (
                          <span className="text-[10px] font-normal opacity-80">Available</span>
                        ) : (
                          <span className="text-[10px] font-normal opacity-80 capitalize">{table.status}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {tables.length === 0 && <p className="text-gray-500 text-center mt-10">Tidak ada meja</p>}
              </div>

              <div className="flex gap-5 mt-4 pt-3 border-t border-gray-700 text-xs flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-blue-500" /> Available</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-orange-500" /> Booked</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-500" /> Occupied</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-600" /> Maintenance</span>
              </div>
            </div>
          )}

          {/* ──────────── ORDER SCREEN ──────────── */}
          {activeModule === "tables" && orderFlow === "order" && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Menu */}
              <div className="flex-1 flex flex-col border-r border-gray-700 overflow-hidden">
                <div className="shrink-0 p-3 border-b border-gray-700 space-y-2 bg-gray-800/40">
                  <div className="flex items-center gap-2">
                    <button onClick={exitOrderFlow} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"><IconArrowLeft className="w-4 h-4"/></button>
                    <span className="text-xs text-gray-400 whitespace-nowrap">Cust. name</span>
                    <input type="text" value={customerName} onChange={(e)=>setCustomerName(e.target.value)} placeholder="Nama pelanggan" className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div className="relative">
                    <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search menu / code" className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-8 pr-8 py-1.5 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
                    {searchQuery && <button onClick={()=>setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"><IconX className="w-3.5 h-3.5"/></button>}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {activeCategory === null && !searchQuery ? (
                    <>
                      <p className="text-xs text-blue-400 font-semibold mb-3">Menu Category Detail</p>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        {categories.map((cat, idx) => (
                          <button key={cat.id} onClick={()=>setActiveCategory(cat.id)} className="rounded-lg p-6 text-center font-bold text-white text-sm transition-all active:scale-95 shadow-md hover:opacity-90 min-h-[90px] flex items-center justify-center" style={{ backgroundColor: catColors[idx % catColors.length] }}>{cat.name}</button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        {!searchQuery && <button onClick={()=>setActiveCategory(null)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"><IconArrowLeft className="w-4 h-4" /></button>}
                        <p className="text-xs text-blue-400 font-semibold">Menu {activeCategory && <span className="text-white">/ {categories.find(c=>c.id===activeCategory)?.name}</span>}{searchQuery && <span className="text-white">/ "{searchQuery}"</span>}</p>
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        {activeCategory && !searchQuery && (
                          <button onClick={()=>setActiveCategory(null)} className="rounded-lg p-4 text-center font-bold text-white text-sm transition-all active:scale-95 shadow-md min-h-[90px] flex items-center justify-center" style={{ backgroundColor: catColors[categories.findIndex(c=>c.id===activeCategory) % catColors.length] }}>{categories.find(c=>c.id===activeCategory)?.name}</button>
                        )}
                        {filteredItems.map((item) => {
                          const isOut = item.stockQuantity <= 0; const cartItem = cart.find(c=>c.id===item.id); const catIdx = categories.findIndex(c=>c.id===item.categoryId);
                          return (
                            <button key={item.id} onClick={()=>!isOut && addToCart(item)} disabled={isOut} className={`relative rounded-lg p-3 text-center text-sm transition-all active:scale-95 shadow-md min-h-[90px] flex flex-col items-center justify-center ${isOut?"opacity-40 cursor-not-allowed":cartItem?"ring-2 ring-white":""}`} style={{ backgroundColor: isOut ? "#4b5563" : catColors[catIdx % catColors.length] }}>
                              {cartItem && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-gray-900 rounded-full text-[10px] font-bold flex items-center justify-center shadow">{cartItem.quantity}</span>}
                              <p className="font-medium line-clamp-2 text-xs mb-1 text-white">{item.name}</p>
                              <p className="text-white/90 font-bold text-[11px]">{formatCurrency(parseFloat(item.price))}</p>
                              {isOut && <p className="text-white text-[10px] mt-0.5">Habis</p>}
                            </button>
                          );
                        })}
                      </div>
                      {filteredItems.length === 0 && <p className="text-gray-500 text-center mt-8">Tidak ada item</p>}
                    </>
                  )}
                </div>
              </div>

              {/* Right: Order / Running Bill panel */}
              <div className="w-80 xl:w-96 flex flex-col bg-gray-800/30 overflow-hidden">
                <div className="shrink-0 p-3 border-b border-gray-700">
                  <div className="bg-blue-600 text-white text-center py-2 rounded-lg font-semibold text-sm">{selectedTable ? `DINE IN - ${selectedTable.name}` : "QUICK SERVICE"}</div>
                  {/* Live billiard time for dine-in */}
                  {selectedTable && liveSession && (
                    <div className="mt-2 bg-emerald-900/30 border border-emerald-700/40 rounded-lg p-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-300 flex items-center gap-1"><IconHourglass className="w-3.5 h-3.5" /> Waktu Biliar</span>
                        <span className="font-mono font-bold text-white">{formatDuration(getElapsedSeconds(liveSession.startTime))}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-emerald-300/70">{liveSession.pricingPackage?.name || "-"}</span>
                        <span className="font-bold text-emerald-400">{formatCurrency(liveTableCost)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {/* Existing orders (running bill) */}
                  {selectedTable && existingOrders.length > 0 && (
                    <div className="px-3 py-2 border-b border-gray-700">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase mb-1.5">Sudah di tagihan</p>
                      {existingOrders.flatMap(o => o.items).map((it, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-gray-300 py-0.5">
                          <span className="truncate">{it.quantity}× {it.itemName}</span>
                          <span className="shrink-0 ml-2">{formatCurrency(parseFloat(it.subtotal))}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Current cart */}
                  {cart.length === 0 ? (
                    existingOrders.length === 0 && !selectedTable ? (
                      <div className="flex items-center justify-center h-full text-gray-500 text-sm">No item</div>
                    ) : (
                      <div className="p-3 text-center text-gray-500 text-xs">Tap menu untuk menambah item baru</div>
                    )
                  ) : (
                    <div className="divide-y divide-gray-700">
                      <div className="px-3 py-2 text-[10px] text-gray-400 font-semibold uppercase">Item Baru</div>
                      {cart.map((item) => (
                        <div key={item.id} className="px-3 py-2.5">
                          <div className="flex items-start gap-2">
                            <div className="flex flex-col items-center gap-1">
                              <button onClick={()=>updateQuantity(item.id,item.quantity+1)} className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white active:scale-90"><IconPlus className="w-3 h-3" /></button>
                              <span className="w-6 text-center font-bold text-xs">{item.quantity}</span>
                              <button onClick={()=>updateQuantity(item.id,item.quantity-1)} className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white active:scale-90"><IconMinus className="w-3 h-3" /></button>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-blue-400 font-medium">{item.name}</p>
                              <p className="text-[10px] text-gray-400">@{formatCurrency(parseFloat(item.price))} | {formatCurrency(parseFloat(item.price)*item.quantity)}</p>
                            </div>
                            <button onClick={()=>removeFromCart(item.id)} className="w-6 h-6 rounded bg-red-600 hover:bg-red-500 flex items-center justify-center text-white active:scale-90 shrink-0"><IconX className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-gray-700 bg-gray-800/60">
                  {selectedTable ? (
                    <div className="px-3 py-2 border-b border-gray-700 text-xs space-y-1">
                      <div className="flex justify-between text-gray-400"><span>Waktu biliar</span><span>{formatCurrency(liveTableCost)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>F&B di tagihan</span><span>{formatCurrency(existingFnbTotal())}</span></div>
                      {cart.length > 0 && <div className="flex justify-between text-gray-400"><span>Item baru</span><span>{formatCurrency(cartSubtotal())}</span></div>}
                      <div className="flex justify-between font-bold text-white pt-1 border-t border-gray-700"><span>Estimasi Tagihan</span><span className="text-green-400">{formatCurrency(runningBillTotal)}</span></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 text-center py-2 border-b border-gray-700 text-xs">
                      <div><p className="text-gray-400 font-semibold">Total Item</p><p className="font-bold text-white">{totalItems}</p></div>
                      <div><p className="text-gray-400 font-semibold">Subtotal</p><p className="font-bold text-green-400">{formatCurrency(cartSubtotal())}</p></div>
                    </div>
                  )}

                  <div className="p-2 space-y-2">
                    {selectedTable ? (
                      <>
                        <button onClick={saveOrder} disabled={isProcessing || cart.length===0} className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 transition-all active:scale-95"><IconShoppingCart className="w-4 h-4" /> Save Order</button>
                        <button onClick={goToPayment} disabled={isProcessing} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-600/20"><IconCash className="w-4 h-4" /> Bayar & Tutup Meja</button>
                      </>
                    ) : (
                      <button onClick={goToPayment} disabled={isProcessing || cart.length===0} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-600/20"><IconCash className="w-4 h-4" /> Lanjut Bayar</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────── PAYMENT SCREEN ──────────── */}
          {activeModule === "tables" && orderFlow === "payment" && billingPreview && (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col border-r border-gray-700 overflow-hidden">
                <div className="shrink-0 p-4 border-b border-gray-700 bg-gray-800/40 flex items-center gap-3">
                  <button onClick={()=>setOrderFlow("order")} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"><IconArrowLeft className="w-5 h-5" /></button>
                  <h2 className="text-base font-bold">Select Payment Method</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1.5 block">Kasir *</label>
                    <select value={selectedStaffId} onChange={(e)=>setSelectedStaffId(e.target.value)} className="w-full max-w-sm bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 focus:outline-none appearance-none">
                      <option value="">Pilih kasir...</option>
                      {staff.filter(s=>s.isActive).map(s=>(<option key={s.id} value={s.id}>{s.name} - {s.role}</option>))}
                    </select>
                  </div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Metode Pembayaran</label>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                    {paymentMethodOptions.map((method, idx) => (
                      <button key={method.id} onClick={()=>{ setSelectedPaymentMethod(method.id); setAmountPaid(""); }} className={`rounded-lg p-6 text-center font-bold text-white text-sm transition-all active:scale-95 shadow-md min-h-[90px] flex items-center justify-center ${selectedPaymentMethod===method.id?"ring-4 ring-white/60":""}`} style={{ backgroundColor: idx===0 ? "#f39c12" : "#3498db" }}>{method.label.toUpperCase()}</button>
                    ))}
                    {paymentMethodOptions.length === 0 && <button className="rounded-lg p-6 text-center font-bold text-white text-sm bg-blue-500 ring-4 ring-white/60 min-h-[90px]">CASH</button>}
                  </div>
                  {/* Cash amount + change */}
                  {isCashPayment && (
                    <div className="mt-4 max-w-md">
                      <label className="text-xs text-gray-400 mb-1.5 block">Uang Dibayar (Cash)</label>
                      {/* Quick nominal buttons */}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {quickCashOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setAmountPaid(String(opt.value))}
                            className={`py-2.5 px-2 rounded-lg text-sm font-semibold transition-all active:scale-95 ${
                              parseFloat(amountPaid || "0") === opt.value
                                ? "bg-green-600 text-white ring-2 ring-green-400"
                                : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <input type="number" value={amountPaid} onChange={(e)=>setAmountPaid(e.target.value)} placeholder={`Nominal lain (${billingPreview.totalCost.toFixed(0)})`} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
                      {amountPaid && parseFloat(amountPaid) >= billingPreview.totalCost && (
                        <p className="text-xs text-green-400 mt-1.5">Kembalian: {formatCurrency(changeDue)}</p>
                      )}
                      {amountPaid && parseFloat(amountPaid) > 0 && parseFloat(amountPaid) < billingPreview.totalCost && (
                        <p className="text-xs text-red-400 mt-1.5">Uang kurang {formatCurrency(billingPreview.totalCost - parseFloat(amountPaid))}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="shrink-0 border-t border-gray-700 p-3 bg-gray-800/40 grid grid-cols-2 gap-3">
                  <div><p className="text-gray-400 text-xs">Total Payment</p><p className="font-bold text-white text-lg">{formatCurrency(billingPreview.totalCost)}</p></div>
                  <div><p className="text-gray-400 text-xs">Kembalian</p><p className="font-bold text-green-400 text-lg">{formatCurrency(changeDue)}</p></div>
                </div>
                <div className="shrink-0 p-3 border-t border-gray-700">
                  <button onClick={savePayment} disabled={isProcessing} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-600/20"><IconCheck className="w-5 h-5" /> {isProcessing ? "Memproses..." : "Save Payment"}</button>
                </div>
              </div>

              {/* Receipt preview */}
              <div className="w-80 xl:w-96 flex flex-col bg-gray-800/30 p-4 overflow-hidden">
                <div className="flex-1 bg-white text-gray-900 rounded-lg overflow-y-auto p-4 font-mono text-xs shadow-xl">
                  <div className="text-center mb-3"><p className="font-bold text-sm">Nova Billiard</p><p className="text-gray-500 text-[10px]">POS Terminal</p></div>
                  <div className="border-t border-dashed border-gray-300 pt-2 space-y-0.5 text-[11px]">
                    <p>No      : ORD-{Date.now().toString().slice(-8)}</p>
                    <p>Date    : {currentTime.toLocaleDateString("id-ID")}</p>
                    <p>Cashier : {staff.find(s=>s.id===parseInt(selectedStaffId))?.name || session?.user?.name || "-"}</p>
                    <p>Table   : {selectedTable?.name || "Quick Service"}</p>
                    <p>Customer: {billingPreview.customerName}</p>
                  </div>
                  {/* Billiard time line */}
                  {billingPreview.tableCost > 0 && (
                    <div className="border-t border-dashed border-gray-300 mt-2 pt-2 text-[11px]">
                      <div className="flex justify-between font-medium"><span>Waktu Biliar</span><span>{formatCurrency(billingPreview.tableCost)}</span></div>
                      <p className="text-gray-500 text-[10px]">{billingPreview.billingDetails.packageName} · {billingPreview.actualDuration} mnt</p>
                    </div>
                  )}
                  {/* F&B items */}
                  <div className="border-t border-dashed border-gray-300 mt-2 pt-2 space-y-1.5 text-[11px]">
                    {orderContext === "standalone"
                      ? cart.map(item=>(
                          <div key={item.id}><p className="font-medium">{item.name}</p><div className="flex justify-between text-gray-600"><span>{item.quantity}x @{formatCurrency(parseFloat(item.price))}</span><span>{formatCurrency(parseFloat(item.price)*item.quantity)}</span></div></div>
                        ))
                      : billingPreview.fnbOrders.flatMap(o=>o.items).map((it,idx)=>(
                          <div key={idx}><p className="font-medium">{it.itemName}</p><div className="flex justify-between text-gray-600"><span>{it.quantity}x @{formatCurrency(parseFloat(it.unitPrice))}</span><span>{formatCurrency(parseFloat(it.subtotal))}</span></div></div>
                        ))
                    }
                  </div>
                  <div className="border-t border-dashed border-gray-300 mt-3 pt-2 space-y-1 text-[11px]">
                    <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(billingPreview.subtotal)}</span></div>
                    {taxSettings.enabled && <div className="flex justify-between"><span>{formatTaxLabel(taxSettings)}</span><span>{formatCurrency(billingPreview.totalTaxAmount)}</span></div>}
                    <div className="flex justify-between font-bold border-t border-dashed border-gray-300 pt-1 mt-1"><span>Grand Total</span><span>{formatCurrency(billingPreview.totalCost)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────── SALES RECAPITULATION ──────────── */}
          {activeModule === "sales-recap" && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Sales Recapitulation</h2>
                  <p className="text-gray-400 text-sm">Ringkasan penjualan 7 hari terakhir</p>
                </div>
                <button onClick={fetchReport} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"><IconRefresh className="w-4 h-4" /> Refresh</button>
              </div>

              {reportLoading ? (
                <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : dailyStats ? (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                    <div className="bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><IconCoin className="w-4 h-4" /> Pendapatan Meja</div>
                      <p className="text-lg font-bold text-green-400">{formatCurrency(Number(dailyStats.sessions.totalRevenue) || 0)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><IconReceipt2 className="w-4 h-4" /> Pendapatan F&B</div>
                      <p className="text-lg font-bold text-green-400">{formatCurrency(Number(dailyStats.fnb.totalRevenue) || 0)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><IconClockHour4 className="w-4 h-4" /> Total Sesi</div>
                      <p className="text-lg font-bold text-white">{dailyStats.sessions.totalSessions}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><IconReceipt2 className="w-4 h-4" /> Order F&B</div>
                      <p className="text-lg font-bold text-white">{dailyStats.fnb.totalOrders}</p>
                    </div>
                  </div>

                  {/* Revenue chart */}
                  <div className="bg-gray-800 rounded-xl p-4 mb-5">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Pendapatan Harian (Meja)</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={(dailyStats.dailyBreakdown || []).map(d => ({ name: new Date(d.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }), revenue: Number(d.revenue) || 0 }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                        <YAxis stroke="#9ca3af" fontSize={11} tickFormatter={(v) => `${(v/1000)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }} formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-center py-10">Tidak ada data.</p>
              )}
            </div>
          )}

          {/* ──────────── SHIFT LOG (today's transactions) ──────────── */}
          {activeModule === "shift-log" && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Shift Log</h2>
                  <p className="text-gray-400 text-sm">Transaksi sukses hari ini</p>
                </div>
                <button onClick={fetchReport} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"><IconRefresh className="w-4 h-4" /> Refresh</button>
              </div>

              {reportLoading ? (
                <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-700/50 text-gray-300 text-xs uppercase">
                      <tr>
                        <th className="text-left px-4 py-3">No. Transaksi</th>
                        <th className="text-left px-4 py-3">Pelanggan</th>
                        <th className="text-left px-4 py-3">Waktu</th>
                        <th className="text-right px-4 py-3">Meja</th>
                        <th className="text-right px-4 py-3">F&B</th>
                        <th className="text-right px-4 py-3">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {todayPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-700/30">
                          <td className="px-4 py-3 font-mono text-xs text-blue-400">{p.transactionNumber}</td>
                          <td className="px-4 py-3 text-gray-200">{p.customerName || "-"}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{formatCurrency(Number(p.tableAmount) || 0)}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{formatCurrency(Number(p.fnbAmount) || 0)}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-400">{formatCurrency(Number(p.totalAmount) || 0)}</td>
                        </tr>
                      ))}
                      {todayPayments.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Belum ada transaksi hari ini</td></tr>
                      )}
                    </tbody>
                    {todayPayments.length > 0 && (
                      <tfoot className="bg-gray-700/50 font-bold">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-right text-gray-300">Total Hari Ini ({todayPayments.length} transaksi)</td>
                          <td className="px-4 py-3 text-right text-green-400">{formatCurrency(todayTotal)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ──────────── DAY START / END ──────────── */}
          {activeModule === "day-start-end" && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Day Start / End</h2>
                  <p className="text-gray-400 text-sm">Ringkasan operasional hari ini — {currentTime.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                <button onClick={fetchReport} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"><IconRefresh className="w-4 h-4" /> Refresh</button>
              </div>

              {reportLoading ? (
                <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5 max-w-3xl">
                    <div className="bg-gradient-to-br from-green-900/40 to-gray-800 rounded-xl p-5 border border-green-700/30">
                      <div className="flex items-center gap-2 text-green-300 text-xs mb-1"><IconCalendarStats className="w-4 h-4" /> Total Penjualan Hari Ini</div>
                      <p className="text-2xl font-bold text-green-400">{formatCurrency(todayTotal)}</p>
                      <p className="text-xs text-gray-400 mt-1">{todayPayments.length} transaksi</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-5">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><IconCoin className="w-4 h-4" /> Pendapatan Meja</div>
                      <p className="text-xl font-bold text-white">{formatCurrency(todayTableTotal)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-5">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><IconReceipt2 className="w-4 h-4" /> Pendapatan F&B</div>
                      <p className="text-xl font-bold text-white">{formatCurrency(todayFnbTotal)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-5">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><IconLayoutGrid className="w-4 h-4" /> Meja Aktif Sekarang</div>
                      <p className="text-xl font-bold text-white">{activeSessions.length}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-5">
                      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><IconClock className="w-4 h-4" /> Jam Operasional</div>
                      <p className="text-xl font-bold text-white font-mono">{currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                  {activeSessions.length > 0 && (
                    <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 max-w-3xl">
                      <p className="text-amber-300 text-sm font-medium">⚠️ Masih ada {activeSessions.length} meja aktif. Selesaikan semua transaksi sebelum tutup hari.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ──────────── TOOLS ──────────── */}
          {activeModule === "tools" && (
            <div className="flex-1 overflow-y-auto p-5">
              <h2 className="text-xl font-bold text-white mb-1">Tools</h2>
              <p className="text-gray-400 text-sm mb-5">Utilitas terminal</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl">
                <button onClick={() => { fetchData(); showAlertMsg("success", "Data berhasil dimuat ulang"); }} className="bg-gray-800 hover:bg-gray-700 rounded-xl p-5 text-left transition-all active:scale-95">
                  <IconRefresh className="w-7 h-7 text-blue-400 mb-2" />
                  <p className="font-semibold text-white text-sm">Refresh Data</p>
                  <p className="text-xs text-gray-400 mt-0.5">Muat ulang menu, meja, & harga</p>
                </button>
                <button onClick={() => { if (document.fullscreenElement) { document.exitFullscreen(); } else { document.documentElement.requestFullscreen(); } }} className="bg-gray-800 hover:bg-gray-700 rounded-xl p-5 text-left transition-all active:scale-95">
                  <IconMaximize className="w-7 h-7 text-purple-400 mb-2" />
                  <p className="font-semibold text-white text-sm">Layar Penuh</p>
                  <p className="text-xs text-gray-400 mt-0.5">Toggle mode fullscreen</p>
                </button>
                <button onClick={() => window.print()} className="bg-gray-800 hover:bg-gray-700 rounded-xl p-5 text-left transition-all active:scale-95">
                  <IconPrinter className="w-7 h-7 text-green-400 mb-2" />
                  <p className="font-semibold text-white text-sm">Test Printer</p>
                  <p className="text-xs text-gray-400 mt-0.5">Cek dialog print browser</p>
                </button>
              </div>
            </div>
          )}

          {/* ──────────── OTHERS ──────────── */}
          {activeModule === "others" && (
            <div className="flex-1 overflow-y-auto p-5">
              <h2 className="text-xl font-bold text-white mb-1">Others</h2>
              <p className="text-gray-400 text-sm mb-5">Navigasi & informasi</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl">
                <button onClick={() => router.push("/dashboard")} className="bg-gray-800 hover:bg-gray-700 rounded-xl p-5 text-left transition-all active:scale-95">
                  <IconExternalLink className="w-7 h-7 text-blue-400 mb-2" />
                  <p className="font-semibold text-white text-sm">Buka Dashboard</p>
                  <p className="text-xs text-gray-400 mt-0.5">Setting & laporan lengkap</p>
                </button>
                <button onClick={() => router.push("/transactions")} className="bg-gray-800 hover:bg-gray-700 rounded-xl p-5 text-left transition-all active:scale-95">
                  <IconClipboardList className="w-7 h-7 text-amber-400 mb-2" />
                  <p className="font-semibold text-white text-sm">Riwayat Transaksi</p>
                  <p className="text-xs text-gray-400 mt-0.5">Lihat semua transaksi</p>
                </button>
                <button onClick={() => signOut({ callbackUrl: "/auth/signin" })} className="bg-gray-800 hover:bg-gray-700 rounded-xl p-5 text-left transition-all active:scale-95">
                  <IconLogout className="w-7 h-7 text-red-400 mb-2" />
                  <p className="font-semibold text-white text-sm">Sign Out</p>
                  <p className="text-xs text-gray-400 mt-0.5">Keluar dari terminal</p>
                </button>
              </div>
              <div className="mt-6 text-xs text-gray-500">
                <p>Nova Billiard POS Terminal · v1.0.0</p>
                <p>Kasir: {session?.user?.name || "-"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Table Activation Modal ═══ */}
      {showActivateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setShowActivateModal(false)}>
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">🎱 Aktifkan {tables.find(t=>t.id===activateTableId)?.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nama Pelanggan *</label>
                <input type="text" value={activateCustomerName} onChange={(e)=>setActivateCustomerName(e.target.value)} placeholder="Nama..." className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:border-blue-500 focus:outline-none" autoFocus />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Paket Harga *</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {pricingPackages.map(pkg=>(
                    <button key={pkg.id} onClick={()=>setActivatePackageId(pkg.id)} className={`w-full p-3 rounded-xl text-left transition-all ${activatePackageId===pkg.id?"bg-blue-600 text-white border-2 border-blue-400":"bg-gray-700 text-gray-300 border-2 border-transparent hover:border-gray-500"}`}>
                      <p className="font-semibold text-sm">{pkg.name}</p>
                      <p className="text-xs opacity-70">{pkg.category==="per_minute"?`Rp ${parseInt(pkg.perMinuteRate).toLocaleString()}/menit`:`Rp ${parseInt(pkg.hourlyRate).toLocaleString()}/jam`}</p>
                    </button>
                  ))}
                  {pricingPackages.length===0 && <p className="text-gray-500 text-sm text-center py-4">Belum ada paket</p>}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowActivateModal(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all active:scale-95">Batal</button>
              <button onClick={activateTable} className="flex-[2] py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"><IconPlayerPlay className="w-5 h-5" /> Mulai Sesi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSTerminal;
