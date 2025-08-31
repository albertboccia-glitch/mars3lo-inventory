import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

// --- CONFIG SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- TYPES ---
type Stock = {
  sku: string;
  articolo: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
};
type Order = {
  id: string;
  customer: string;
  stato: string;
  created_at: string;
};
type OrderLine = {
  id: number;
  order_id: string;
  sku: string;
  articolo: string;
  taglia: string;
  colore: string;
  richiesti: number;
  confermati: number;
  prezzo: number;
};

// --- CLASSIFY ---
function classify(sku: string): string {
  const up = sku.toUpperCase();
  if (/^GB\d+/.test(up)) return "Giubbotti";
  if (/^G\d+/.test(up)) return "Giacche";
  if (/^P\d+/.test(up)) return "Pantaloni";
  if (/^MG\d+/.test(up) || /^M\d+/.test(up)) return "Maglie";
  if (/^C\d+/.test(up)) return "Camicie";
  return "Altro";
}

// --- APP ---
export default function App() {
  const [role, setRole] = useState<"login" | "showroom" | "magazzino">("login");
  const [stock, setStock] = useState<Stock[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tutte");
  const [newOrderBadge, setNewOrderBadge] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- LOGIN HANDLER ---
  const handleLogin = (id: string, password: string) => {
    if (id === "Mars3loBo" && password === "Francesco01") {
      setRole("showroom");
    } else if (id === "Mars3loNa" && password === "Gbesse01") {
      setRole("magazzino");
    } else {
      alert("Credenziali errate");
    }
  };

  // --- LOAD STOCK ---
  useEffect(() => {
    if (role !== "login") {
      loadStock();
    }
  }, [role]);

  async function loadStock() {
    setLoading(true);
    const { data, error } = await supabase.from("stock").select("*");
    if (error) console.error(error);
    else setStock(data as Stock[]);
    setLoading(false);
  }

  // --- LOAD ORDERS ---
  useEffect(() => {
    if (role === "magazzino") {
      loadOrders();
      const sub = supabase
        .channel("orders")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
          setNewOrderBadge(true);
          loadOrders();
        })
        .subscribe();
      return () => {
        supabase.removeChannel(sub);
      };
    }
  }, [role]);

  async function loadOrders() {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) console.error(error);
    else setOrders(data as Order[]);
  }

  async function loadOrderLines(orderId: string) {
    const { data, error } = await supabase.from("order_lines").select("*").eq("order_id", orderId);
    if (error) console.error(error);
    else setOrderLines(data as OrderLine[]);
  }

  // --- ADD TO CART ---
  function addToCart(group: Stock[], values: Record<string, number>) {
    const lines: OrderLine[] = [];
    group.forEach((s) => {
      const qty = values[s.taglia] || 0;
      if (qty > 0) {
        lines.push({
          id: Date.now() + Math.random(),
          order_id: "",
          sku: s.sku,
          articolo: s.articolo,
          taglia: s.taglia,
          colore: s.colore,
          richiesti: qty,
          confermati: 0,
          prezzo: s.prezzo,
        });
      }
    });
    setCart((prev) => [...prev.filter((l) => l.articolo !== group[0].articolo || l.colore !== group[0].colore), ...lines]);
  }

  function clearGroup(articolo: string, colore: string) {
    setCart((prev) => prev.filter((l) => !(l.articolo === articolo && l.colore === colore)));
  }
  function clearAll() {
    setCart([]);
  }

  // --- SUBMIT ORDER ---
  async function submitOrder() {
    if (!customer) {
      alert("Inserisci cliente");
      return;
    }
    const orderId = Date.now().toString();
    const { error } = await supabase.from("orders").insert({ id: orderId, customer, stato: "In attesa" });
    if (error) {
      console.error(error);
      return;
    }
    const { error: err2 } = await supabase.from("order_lines").insert(
      cart.map((c) => ({ ...c, order_id: orderId }))
    );
    if (err2) console.error(err2);
    else {
      alert("Ordine inviato");
      setCart([]);
    }
  }

  // --- CONFIRM / ANNULLA / MODIFICA ---
  async function confirmOrder(order: Order, confirms: Record<number, number>) {
    for (const line of orderLines) {
      const conf = confirms[line.id] || 0;
      await supabase.from("order_lines").update({ confermati: conf }).eq("id", line.id);
      if (conf > 0) {
        await supabase.rpc("decrementa_stock", { p_sku: line.sku, p_qty: conf });
      }
    }
    await supabase.from("orders").update({ stato: "Confermato" }).eq("id", order.id);
    alert("Ordine confermato");
    loadOrders();
  }

  async function annullaOrdine(orderId: string) {
    await supabase.from("order_lines").delete().eq("order_id", orderId);
    await supabase.from("orders").delete().eq("id", orderId);
    alert("Ordine annullato");
    loadOrders();
  }

  // --- EXPORT ---
  function exportCSV() {
    const rows = cart.map((c) => [customer, c.articolo, c.colore, c.taglia, c.richiesti, c.prezzo, c.richiesti * c.prezzo]);
    const header = ["Cliente", "Articolo", "Colore", "Taglia", "Qta", "Prezzo", "Totale"];
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ordine.csv";
    a.click();
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(cart.map((c) => ({
      Cliente: customer,
      Articolo: c.articolo,
      Colore: c.colore,
      Taglia: c.taglia,
      Quantità: c.richiesti,
      Prezzo: c.prezzo,
      Totale: c.richiesti * c.prezzo,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, "ordine.xlsx");
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.text("Ordine Cliente: " + customer, 10, 10);
    const rows = cart.map((c) => [c.articolo, c.colore, c.taglia, c.richiesti, c.prezzo, c.richiesti * c.prezzo]);
    (doc as any).autoTable({
      head: [["Articolo", "Colore", "Taglia", "Qta", "Prezzo", "Totale"]],
      body: rows,
    });
    doc.save("ordine.pdf");
  }

  // --- LOGIN PAGE ---
  if (role === "login") {
    const [id, setId] = useState("");
    const [pw, setPw] = useState("");
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="bg-white p-8 rounded shadow-md w-80 text-center">
          <img src="/public/mars3lo.png" alt="Mars3lo" className="h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-4">Accesso</h1>
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="ID" className="border p-2 mb-2 w-full" />
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className="border p-2 mb-4 w-full" />
          <button onClick={() => handleLogin(id, pw)} className="bg-black text-white px-4 py-2 rounded w-full">Login</button>
        </div>
      </div>
    );
  }

  // --- SHOWROOM PAGE ---
  if (role === "showroom") {
    const grouped = groupByArticle(stock);
    const cats = ["Tutte", "Giacche", "Pantaloni", "Giubbotti", "Maglie", "Camicie"];
    const filteredKeys = Object.keys(grouped).filter((k) => {
      const arr = grouped[k];
      const cat = classify(arr[0].sku);
      return (category === "Tutte" || category === cat) && (search === "" || k.toLowerCase().includes(search.toLowerCase()));
    });

    const total = cart.reduce((s, c) => s + c.richiesti * c.prezzo, 0);
    const totalDiscounted = total * (1 - discount / 100);

    return (
      <div className="p-4">
        <header className="flex justify-between items-center mb-4">
          <img src="/public/mars3lo.png" alt="Mars3lo" className="h-12" />
          <div className="flex gap-4 items-center">
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nome cliente" className="border p-2" />
            <div className="flex items-center gap-2">
              <label className="font-semibold">Sconto %</label>
              <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="border p-1 w-16" />
            </div>
          </div>
        </header>

        <div className="flex gap-4 mb-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca..." className="border p-2 flex-1" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="border p-2">
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <p>Caricamento...</p>
        ) : (
          <div>
            {filteredKeys.map((key) => (
              <GroupRow key={key} group={grouped[key]} addToCart={addToCart} clearGroup={clearGroup} />
            ))}
          </div>
        )}

        {/* Carrello */}
        <div className="mt-6 border-t pt-4">
          <h2 className="font-bold text-lg mb-2">Carrello</h2>
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th>Articolo</th><th>Colore</th><th>Taglia</th><th>Qta</th><th>Prezzo</th><th>Totale</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((c) => (
                <tr key={c.id}>
                  <td>{c.articolo}</td><td>{c.colore}</td><td>{c.taglia}</td><td>{c.richiesti}</td><td>{c.prezzo}</td><td>{c.richiesti * c.prezzo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 font-bold">Totale: € {total.toFixed(2)} | Sconto: {discount}% | Imponibile: € {totalDiscounted.toFixed(2)}</div>
          <div className="flex gap-2 mt-2">
            <button onClick={submitOrder} className="bg-green-600 text-white px-3 py-1 rounded">Invia Ordine</button>
            <button onClick={clearAll} className="bg-red-500 text-white px-3 py-1 rounded">Svuota tutto</button>
            <button onClick={exportCSV} className="bg-gray-500 text-white px-3 py-1 rounded">CSV</button>
            <button onClick={exportExcel} className="bg-gray-500 text-white px-3 py-1 rounded">Excel</button>
            <button onClick={exportPDF} className="bg-gray-500 text-white px-3 py-1 rounded">PDF</button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAGAZZINO PAGE ---
  if (role === "magazzino") {
    return (
      <div>
        {/* Barra nera con logo + scritta */}
        <header className="bg-black h-20 flex flex-col items-center justify-center mb-4">
          <img src="/public/mars3lo.png" alt="Mars3lo" className="h-10 mb-1" />
          <span className="text-white font-bold tracking-wide">MARS3LO B2B</span>
        </header>

        <div className="p-4">
          <h1 className="text-xl font-bold mb-4">
            Ordini ricevuti {newOrderBadge && <span className="text-red-600">🔔 Nuovo!</span>}
          </h1>
          <table className="w-full text-sm border">
            <thead><tr className="bg-gray-100"><th>ID</th><th>Cliente</th><th>Data</th><th>Stato</th><th>Azioni</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td><td>{o.customer}</td><td>{new Date(o.created_at).toLocaleString()}</td><td>{o.stato}</td>
                  <td>
                    <button onClick={() => loadOrderLines(o.id)} className="bg-blue-500 text-white px-2 py-1 mr-2">Vedi</button>
                    <button onClick={() => annullaOrdine(o.id)} className="bg-red-600 text-white px-2 py-1">Annulla</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {orderLines.length > 0 && (
            <div className="mt-4">
              <h2 className="font-bold">Dettaglio ordine</h2>
              <table className="w-full text-sm border">
                <thead><tr><th>Articolo</th><th>Colore</th><th>Taglia</th><th>Richiesti</th><th>Confermati</th></tr></thead>
                <tbody>
                  {orderLines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.articolo}</td><td>{l.colore}</td><td>{l.taglia}</td><td>{l.richiesti}</td>
                      <td><input type="number" defaultValue={l.richiesti} className="border w-16" id={`conf-${l.id}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => {
                  const confirms: Record<number, number> = {};
                  orderLines.forEach((l) => {
                    const v = (document.getElementById(`conf-${l.id}`) as HTMLInputElement).value;
                    confirms[l.id] = Number(v);
                  });
                  confirmOrder({ id: orderLines[0].order_id, customer: "", stato: "", created_at: "" }, confirms);
                }}
                className="bg-green-600 text-white px-3 py-1 mt-2 rounded"
              >Conferma</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// --- Group by articolo/colore ---
function groupByArticle(stock: Stock[]) {
  return stock.reduce((acc: any, s) => {
    const key = s.articolo + "-" + s.colore;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
}

// --- GroupRow component ---
function GroupRow({ group, addToCart, clearGroup }: { group: Stock[]; addToCart: Function; clearGroup: Function }) {
  const [values, setValues] = useState<Record<string, number>>({});
  const g0 = group[0];
  return (
    <div className="border p-2 mb-2">
      <div className="font-bold">{g0.articolo} – {classify(g0.sku)} – {g0.colore} – Prezzo € {g0.prezzo}</div>
      <div className="flex flex-wrap gap-2 mt-2">
        {group.map((s) => (
          <div key={s.taglia} className="border p-2 text-center">
            <div>{s.taglia}</div>
            <div className="text-xs text-gray-500">Disp: {s.qty}</div>
            <input type="number" min={0} max={s.qty} defaultValue={0} onChange={(e) => setValues({ ...values, [s.taglia]: Number(e.target.value) })} className="border w-16" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={() => addToCart(group, values)} className="bg-green-600 text-white px-3 py-1 rounded">Aggiungi</button>
        <button onClick={() => clearGroup(g0.articolo, g0.colore)} className="bg-gray-500 text-white px-3 py-1 rounded">Svuota</button>
      </div>
    </div>
  );
}
