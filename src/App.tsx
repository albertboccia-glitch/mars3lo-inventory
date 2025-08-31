import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// Types
interface Stock {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
}
interface CartLine extends Stock {
  qtyOrd: number;
}
interface Order {
  id: string;
  customer: string;
  stato: string;
  created_at: string;
}
interface OrderLine {
  id: number;
  order_id: string;
  sku: string;
  articolo: string;
  taglia: string;
  colore: string;
  richiesti: number;
  confermati: number;
  prezzo: number;
}

// Helpers
function classify(sku: string): string {
  const up = sku.toUpperCase();
  if (/^GB\d+/.test(up)) return "Giubbotti";
  if (/^G\d+/.test(up)) return "Giacche";
  if (/^P\d+/.test(up)) return "Pantaloni";
  if (/^MG\d+/.test(up) || /^M\d+/.test(up)) return "Maglie";
  return "Altro";
}
function formatCurrency(v: number) {
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export default function App() {
  // Login
  const [role, setRole] = useState<"showroom" | "magazzino" | null>(null);
  const [logged, setLogged] = useState(false);

  // Data
  const [stock, setStock] = useState<Stock[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [newOrderBadge, setNewOrderBadge] = useState(false);

  // Load
  useEffect(() => {
    if (logged) {
      loadStock();
      if (role === "magazzino") loadOrders();
      subscribeRealtime();
    }
  }, [logged]);

  async function loadStock() {
    const { data } = await supabase.from("stock").select("*");
    if (data) setStock(data as Stock[]);
  }
  async function loadOrders() {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (data) setOrders(data as Order[]);
  }
  async function loadOrderLines(orderId: string) {
    const { data } = await supabase.from("order_lines").select("*").eq("order_id", orderId);
    if (data) setOrderLines(data as OrderLine[]);
  }

  function subscribeRealtime() {
    supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (role === "magazzino") setNewOrderBadge(true);
        loadOrders();
      })
      .subscribe();
  }

  // Cart
  function addGroupToCart(group: Stock[], inputs: Record<string, number>) {
    const filtered = group.filter((g) => inputs[g.taglia] && inputs[g.taglia] > 0);
    const rest = cart.filter((c) => !(c.articolo === group[0].articolo && c.colore === group[0].colore));
    const newLines: CartLine[] = filtered.map((g) => ({ ...g, qtyOrd: inputs[g.taglia] }));
    setCart([...rest, ...newLines]);
  }
  function clearGroupFromCart(group: Stock[]) {
    const rest = cart.filter((c) => !(c.articolo === group[0].articolo && c.colore === group[0].colore));
    setCart(rest);
  }

  async function sendOrder() {
    if (!customer || cart.length === 0) return alert("Inserisci cliente e articoli");
    const id = Date.now().toString();
    await supabase.from("orders").insert([{ id, customer, stato: "In attesa" }]);
    await supabase.from("order_lines").insert(
      cart.map((c) => ({
        order_id: id,
        sku: c.sku,
        articolo: c.articolo,
        taglia: c.taglia,
        colore: c.colore,
        richiesti: c.qtyOrd,
        prezzo: c.prezzo,
        confermati: 0,
      }))
    );
    setCart([]);
    alert("Ordine inviato!");
  }

  async function confirmOrder(orderId: string, confirms: Record<string, number>) {
    for (const l of orderLines) {
      const q = confirms[l.id] || 0;
      await supabase.from("order_lines").update({ confermati: q }).eq("id", l.id);
      await supabase.rpc("decrementa_stock", { p_sku: l.sku, p_qty: q });
    }
    await supabase.from("orders").update({ stato: "Confermato" }).eq("id", orderId);
    setOrderLines([]);
    loadOrders();
    alert("Ordine confermato");
  }

  // Export
  function exportCSV() {
    const rows = cart.map((c) => [customer, c.articolo, c.colore, c.taglia, c.qtyOrd, c.prezzo, c.qtyOrd * c.prezzo]);
    const header = ["Cliente", "Articolo", "Colore", "Taglia", "Quantità", "Prezzo", "Totale"];
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    saveAs(new Blob([csv], { type: "text/csv" }), "ordine.csv");
  }
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(cart.map((c) => ({
      Cliente: customer,
      Articolo: c.articolo,
      Colore: c.colore,
      Taglia: c.taglia,
      Quantità: c.qtyOrd,
      Prezzo: c.prezzo,
      Totale: c.qtyOrd * c.prezzo,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), "ordine.xlsx");
  }
  function exportPDF() {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [["Cliente", "Articolo", "Colore", "Taglia", "Quantità", "Prezzo", "Totale"]],
      body: cart.map((c) => [customer, c.articolo, c.colore, c.taglia, c.qtyOrd, formatCurrency(c.prezzo), formatCurrency(c.qtyOrd * c.prezzo)]),
    });
    doc.save("ordine.pdf");
  }

  // Totals
  const total = cart.reduce((s, c) => s + c.qtyOrd * c.prezzo, 0);
  const totalDisc = total * (1 - discount / 100);

  // --- UI ---
  if (!logged) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <img src="/public/mars3lo.png" alt="Mars3lo" className="h-24 mb-6" />
        <h1 className="text-2xl mb-4">Login</h1>
        <LoginForm setLogged={setLogged} setRole={setRole} />
      </div>
    );
  }

  return (
    <div className="p-4">
      {role === "magazzino" && (
        <header className="bg-black p-4 mb-4 flex justify-center">
          <img src="/public/mars3lo.png" alt="Mars3lo" className="h-12" />
        </header>
      )}

      {/* Showroom */}
      {role === "showroom" && (
        <div>
          <h1 className="text-xl font-bold mb-2">Showroom – Nuovo Ordine</h1>
          <input placeholder="Cliente" value={customer} onChange={(e) => setCustomer(e.target.value)} className="border p-2 mr-2" />
          <div className="flex items-center gap-2 mt-2 mb-4">
            <label className="font-semibold">Sconto %</label>
            <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="border p-1 w-16" />
          </div>
          <input placeholder="Cerca articolo..." value={search} onChange={(e) => setSearch(e.target.value)} className="border p-2 mb-2 w-full" />
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="border p-2 mb-4 w-full">
            <option value="">Tutte le categorie</option>
            <option value="Giacche">Giacche</option>
            <option value="Giubbotti">Giubbotti</option>
            <option value="Pantaloni">Pantaloni</option>
            <option value="Maglie">Maglie</option>
          </select>

          {Object.entries(groupByArticle(stock.filter((s) => (!search || s.articolo.includes(search)) && (!filterCat || s.categoria === filterCat)))).
            map(([k, group]) => (
              <StockGroup key={k} group={group as Stock[]} addGroupToCart={addGroupToCart} clearGroupFromCart={clearGroupFromCart} />
          ))}

          <div className="mt-6">
            <h2 className="font-bold">Carrello</h2>
            {cart.map((c) => (
              <div key={c.sku} className="flex justify-between border-b py-1">
                <span>{c.articolo} {c.colore} {c.taglia} x{c.qtyOrd}</span>
                <span>{formatCurrency(c.qtyOrd * c.prezzo)}</span>
              </div>
            ))}
            <div className="mt-2 font-bold">Totale: {formatCurrency(totalDisc)}</div>
            <button onClick={sendOrder} className="bg-green-600 text-white px-3 py-1 mt-2 rounded">Invia Ordine</button>
            <button onClick={() => setCart([])} className="bg-gray-500 text-white px-3 py-1 mt-2 ml-2 rounded">Svuota Tutto</button>
            <div className="flex gap-2 mt-2">
              <button onClick={exportCSV} className="bg-blue-500 text-white px-2 py-1 rounded">CSV</button>
              <button onClick={exportExcel} className="bg-blue-500 text-white px-2 py-1 rounded">Excel</button>
              <button onClick={exportPDF} className="bg-blue-500 text-white px-2 py-1 rounded">PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Magazzino */}
      {role === "magazzino" && (
        <div>
          <h1 className="text-xl font-bold mb-2">MAGAZZINO – Ordini</h1>
          {newOrderBadge && <div className="text-red-600 font-bold">🔔 Nuovo ordine arrivato!</div>}
          {orders.map((o) => (
            <div key={o.id} className="border p-2 my-2">
              <div className="flex justify-between">
                <span>{o.customer} – {o.stato}</span>
                <button onClick={() => loadOrderLines(o.id)} className="bg-blue-500 text-white px-2 py-1 rounded">Dettagli</button>
              </div>
              {orderLines.length > 0 && orderLines[0].order_id === o.id && (
                <div>
                  {orderLines.map((l) => (
                    <div key={l.id} className="flex justify-between border-b">
                      <span>{l.articolo} {l.colore} {l.taglia} richiesti {l.richiesti}</span>
                    </div>
                  ))}
                  <button onClick={() => confirmOrder(o.id, {})} className="bg-green-600 text-white px-3 py-1 mt-2 rounded">Conferma</button>
                  <button onClick={() => supabase.from("orders").update({ stato: "Annullato" }).eq("id", o.id)} className="bg-red-600 text-white px-3 py-1 mt-2 ml-2 rounded">Annulla</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Components ---
function LoginForm({ setLogged, setRole }: { setLogged: any; setRole: any }) {
  const [id, setId] = useState(""); const [pw, setPw] = useState("");
  function submit() {
    if (id === "Mars3loBo" && pw === "Francesco01") { setRole("showroom"); setLogged(true); }
    else if (id === "Mars3loNa" && pw === "Gbesse01") { setRole("magazzino"); setLogged(true); }
    else alert("Credenziali errate");
  }
  return (
    <div className="flex flex-col gap-2">
      <input placeholder="ID" value={id} onChange={(e) => setId(e.target.value)} className="text-black p-2" />
      <input type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} className="text-black p-2" />
      <button onClick={submit} className="bg-white text-black px-3 py-1 rounded">Login</button>
    </div>
  );
}

function StockGroup({ group, addGroupToCart, clearGroupFromCart }: { group: Stock[]; addGroupToCart: any; clearGroupFromCart: any }) {
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const g0 = group[0];
  return (
    <div className="border p-2 mb-2">
      <div className="font-bold">{g0.articolo} {g0.categoria} – <span className="font-bold">{g0.colore}</span> – Prezzo: {formatCurrency(g0.prezzo)}</div>
      <div className="flex gap-2 mt-2">
        {group.map((s) => (
          <div key={s.taglia} className="flex flex-col items-center">
            <span>{s.taglia}</span>
            <span className="text-sm text-gray-600">{s.qty} disp</span>
            <input type="number" min="0" value={inputs[s.taglia] || ""} onChange={(e) => setInputs({ ...inputs, [s.taglia]: Number(e.target.value) })} className="border w-16 p-1" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={() => addGroupToCart(group, inputs)} className="bg-green-500 text-white px-2 py-1 rounded">Aggiungi</button>
        <button onClick={() => clearGroupFromCart(group)} className="bg-gray-500 text-white px-2 py-1 rounded">Svuota</button>
      </div>
    </div>
  );
}

// --- Helper ---
function groupByArticle(stock: Stock[]) {
  return stock.reduce((acc: any, s) => {
    const key = s.articolo + "-" + s.colore;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
}
