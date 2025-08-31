import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// --- Supabase ---
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// --- Types ---
interface Stock {
  sku: string;
  articolo: string;
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

// --- Helpers ---
function classify(sku: string): string {
  const up = sku.toUpperCase();
  if (/^GB\d+/.test(up)) return "Giubbotti";
  if (/^G\d+/.test(up)) return "Giacche";
  if (/^P\d+/.test(up)) return "Pantaloni";
  if (/^MG\d+/.test(up) || /^M\d+/.test(up)) return "Maglie";
  if (/^C\d+/.test(up)) return "Camicie";
  return "Altro";
}

function formatCurrency(v: number) {
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export default function App() {
  // --- Login ---
  const [role, setRole] = useState<"showroom" | "magazzino" | null>(null);
  const [logged, setLogged] = useState(false);

  // --- Data ---
  const [stock, setStock] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [newOrderBadge, setNewOrderBadge] = useState(false);

  // --- Load ---
  useEffect(() => {
    if (logged) {
      loadStock();
      if (role === "magazzino") loadOrders();
      subscribeRealtime();
    }
  }, [logged]);

  async function loadStock() {
    setLoading(true);
    const { data } = await supabase.from("stock").select("*");
    if (data) setStock(data as Stock[]);
    setLoading(false);
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
        if (role === "magazzino") {
          setNewOrderBadge(true);
          loadOrders();
        }
        if (role === "showroom") loadOrders();
      })
      .subscribe();
  }

  // --- Cart ---
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
  function clearCart() {
    setCart([]);
  }

  // --- Export PDF ---
  function exportPDF() {
    const doc = new jsPDF();
    doc.text(`Ordine cliente: ${customer}`, 10, 10);
    autoTable(doc, {
      head: [["Articolo", "Colore", "Taglia", "Q.tà", "Prezzo", "Totale"]],
      body: cart.map((c) => [
        c.articolo,
        c.colore,
        c.taglia,
        c.qtyOrd,
        formatCurrency(c.prezzo),
        formatCurrency(c.qtyOrd * c.prezzo),
      ]),
    });
    const tot = cart.reduce((s, c) => s + c.qtyOrd * c.prezzo, 0);
    const totDisc = tot * (1 - discount / 100);
    doc.text(`Totale: ${formatCurrency(totDisc)} (sconto ${discount}%)`, 10, doc.lastAutoTable.finalY + 10);
    doc.save("ordine.pdf");
  }

  // --- Export Excel ---
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
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([out], { type: "application/octet-stream" }), "ordine.xlsx");
  }

  // --- Submit Order ---
  async function submitOrder() {
    if (!customer || cart.length === 0) return alert("Compila cliente e aggiungi articoli");
    const { data: orderData, error } = await supabase.from("orders").insert([{ id: crypto.randomUUID(), customer, stato: "In attesa" }]).select();
    if (error) return alert("Errore ordine");
    const orderId = orderData![0].id;
    await supabase.from("order_lines").insert(
      cart.map((c) => ({
        order_id: orderId,
        sku: c.sku,
        articolo: c.articolo,
        taglia: c.taglia,
        colore: c.colore,
        richiesti: c.qtyOrd,
        confermati: 0,
        prezzo: c.prezzo,
      }))
    );
    setCart([]);
    alert("Ordine inviato");
  }

  // --- Confirm / Annulla ---
  async function confirmOrder(order: Order, confirms: Record<string, number>) {
    for (const ol of orderLines) {
      const conf = confirms[ol.id] || 0;
      await supabase.from("order_lines").update({ confermati: conf }).eq("id", ol.id);
      if (conf > 0) {
        await supabase.rpc("decrementa_stock", { p_sku: ol.sku, p_qty: conf });
      }
    }
    await supabase.from("orders").update({ stato: "Confermato" }).eq("id", order.id);
    loadOrders();
    alert("Ordine confermato");
  }

  async function annullaOrdine(orderId: string) {
    await supabase.from("orders").update({ stato: "Annullato" }).eq("id", orderId);
    loadOrders();
    alert("Ordine annullato");
  }

  // --- UI ---
  if (!logged) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <img src="/public/mars3lo.png" alt="Mars3lo" className="h-20 mb-6" />
        <div className="bg-gray-800 p-6 rounded">
          <h1 className="text-xl mb-4">Login</h1>
          <input id="id" placeholder="ID" className="block mb-2 p-2 text-black w-64" />
          <input id="pw" type="password" placeholder="Password" className="block mb-4 p-2 text-black w-64" />
          <button
            className="bg-green-600 px-4 py-2 rounded"
            onClick={() => {
              const id = (document.getElementById("id") as HTMLInputElement).value;
              const pw = (document.getElementById("pw") as HTMLInputElement).value;
              if (id === "Mars3loBo" && pw === "Francesco01") {
                setRole("showroom");
                setLogged(true);
              } else if (id === "Mars3loNa" && pw === "Gbesse01") {
                setRole("magazzino");
                setLogged(true);
              } else alert("Credenziali errate");
            }}
          >
            Entra
          </button>
        </div>
      </div>
    );
  }

  // --- Showroom ---
  if (role === "showroom") {
    const groups = groupByArticle(stock);
    return (
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <input
            placeholder="Cliente"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="border p-2"
          />
          <label className="font-semibold">Sconto %</label>
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="border p-2 w-16"
          />
        </div>
        <div className="flex gap-4 mb-4">
          <input placeholder="Cerca codice..." value={search} onChange={(e) => setSearch(e.target.value)} className="border p-2 flex-1" />
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="border p-2">
            <option value="">Tutte</option>
            <option>Giacche</option>
            <option>Pantaloni</option>
            <option>Giubbotti</option>
            <option>Maglie</option>
            <option>Camicie</option>
          </select>
        </div>

        {loading ? <p>Caricamento…</p> : (
          Object.entries(groups).map(([key, items]) => {
            if (search && !key.toLowerCase().includes(search.toLowerCase())) return null;
            if (filterCat && classify(items[0].sku) !== filterCat) return null;
            const inputs: Record<string, number> = {};
            return (
              <div key={key} className="border p-2 mb-2">
                <div className="font-bold">{items[0].articolo} {classify(items[0].sku)} <span className="ml-2">{items[0].colore}</span> – Prezzo: {formatCurrency(items[0].prezzo)}</div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {items.map((s) => (
                    <div key={s.taglia} className="flex flex-col items-center border p-2 w-16">
                      <div>{s.taglia}</div>
                      <div className="text-sm text-gray-600">{s.qty}</div>
                      <input type="number" min={0} max={s.qty} defaultValue={0} className="w-12 border" onChange={(e) => inputs[s.taglia] = Number(e.target.value)} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="bg-blue-600 text-white px-2 py-1 rounded" onClick={() => addGroupToCart(items, inputs)}>Aggiungi</button>
                  <button className="bg-red-600 text-white px-2 py-1 rounded" onClick={() => clearGroupFromCart(items)}>Svuota</button>
                </div>
              </div>
            );
          })
        )}

        <h2 className="font-bold mt-4">Carrello</h2>
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th>Articolo</th><th>Colore</th><th>Taglia</th><th>Q.tà</th><th>Prezzo</th><th>Totale</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((c, i) => (
              <tr key={i}>
                <td>{c.articolo}</td>
                <td>{c.colore}</td>
                <td>{c.taglia}</td>
                <td>{c.qtyOrd}</td>
                <td>{formatCurrency(c.prezzo)}</td>
                <td>{formatCurrency(c.qtyOrd * c.prezzo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 font-bold">
          Totale: {formatCurrency(cart.reduce((s, c) => s + c.qtyOrd * c.prezzo, 0) * (1 - discount / 100))}
        </div>
        <div className="flex gap-2 mt-2">
          <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={submitOrder}>Invia ordine</button>
          <button className="bg-yellow-600 text-white px-3 py-1 rounded" onClick={exportPDF}>PDF</button>
          <button className="bg-yellow-600 text-white px-3 py-1 rounded" onClick={exportExcel}>Excel</button>
          <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={clearCart}>Svuota tutto</button>
        </div>
      </div>
    );
  }

  // --- Magazzino ---
  if (role === "magazzino") {
    return (
      <div>
        <header className="bg-black p-4 flex justify-center">
          <img src="/public/mars3lo.png" alt="Mars3lo" className="h-12" />
        </header>
        <div className="p-4">
          <h1 className="text-xl font-bold mb-4">Ordini ricevuti {newOrderBadge && <span className="text-red-600">🔔 Nuovo!</span>}</h1>
          {orders.map((o) => (
            <div key={o.id} className="border p-2 mb-2">
              <div className="font-bold">{o.customer} – Stato: {o.stato}</div>
              <button onClick={() => loadOrderLines(o.id)} className="bg-blue-600 text-white px-2 py-1 mt-1 rounded">Vedi righe</button>
              <button onClick={() => annullaOrdine(o.id)} className="bg-red-600 text-white px-2 py-1 mt-1 rounded ml-2">Annulla</button>
              {orderLines.length > 0 && orderLines[0].order_id === o.id && (
                <div className="mt-2">
                  <table className="w-full border">
                    <thead><tr className="bg-gray-200"><th>Articolo</th><th>Colore</th><th>Taglia</th><th>Richiesti</th><th>Confermati</th></tr></thead>
                    <tbody>
                      {orderLines.map((l) => (
                        <tr key={l.id}>
                          <td>{l.articolo}</td>
                          <td>{l.colore}</td>
                          <td>{l.taglia}</td>
                          <td>{l.richiesti}</td>
                          <td><input type="number" defaultValue={l.richiesti} max={l.richiesti} min={0} className="border w-16" id={`conf-${l.id}`} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    className="bg-green-600 text-white px-3 py-1 mt-2 rounded"
                    onClick={() => {
                      const confirms: Record<string, number> = {};
                      orderLines.forEach((l) => {
                        const v = (document.getElementById(`conf-${l.id}`) as HTMLInputElement).value;
                        confirms[l.id] = Number(v);
                      });
                      confirmOrder(o, confirms);
                    }}
                  >
                    Conferma
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

// --- Group helper ---
function groupByArticle(stock: Stock[]) {
  return stock.reduce((acc: any, s) => {
    const key = s.articolo + "-" + s.colore;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
}
