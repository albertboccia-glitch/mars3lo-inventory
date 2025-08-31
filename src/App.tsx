import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// Classificazione articoli
function classify(code: string): string {
  if (/^GB\d+/i.test(code)) return "Giubbotti";
  if (/^G\d+/i.test(code)) return "Giacche";
  if (/^M\d+/i.test(code)) return "Maglie";
  if (/^P\d+/i.test(code)) return "Pantaloni";
  return "Altro";
}

type StockRow = {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
};

type CartRow = {
  sku: string;
  articolo: string;
  colore: string;
  taglia: string;
  richiesti: number;
  prezzo: number;
};

type Order = {
  id: string;
  customer: string;
  stato: string;
  created_at: string;
};

export default function App() {
  const [role, setRole] = useState<"showroom" | "magazzino" | null>(null);
  const [user, setUser] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [logged, setLogged] = useState(false);

  const [stock, setStock] = useState<StockRow[]>([]);
  const [cart, setCart] = useState<CartRow[]>([]);
  const [customer, setCustomer] = useState<string>("");
  const [sconto, setSconto] = useState<number>(0);

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderLines, setOrderLines] = useState<Record<string, CartRow[]>>({});

  // Login
  const handleLogin = () => {
    if (user === "Mars3loBo" && password === "Francesco01") {
      setRole("showroom");
      setLogged(true);
    } else if (user === "Mars3loNa" && password === "Gbesse01") {
      setRole("magazzino");
      setLogged(true);
    } else {
      alert("Credenziali errate");
    }
  };

  // Load stock from Supabase
  const loadStock = async () => {
    const { data } = await supabase.from("stock").select("*");
    if (data) setStock(data as StockRow[]);
  };

  // Load orders (for magazzino)
  const loadOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (data) setOrders(data as Order[]);
    for (const ord of data || []) {
      const { data: righe } = await supabase.from("order_lines").select("*").eq("order_id", ord.id);
      setOrderLines(prev => ({ ...prev, [ord.id]: righe as any }));
    }
  };

  useEffect(() => {
    if (logged) {
      loadStock();
      if (role === "magazzino") loadOrders();
      // Realtime
      const channel = supabase.channel("realtime:all");
      channel.on("postgres_changes", { event: "*", schema: "public", table: "stock" }, loadStock);
      channel.on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders);
      channel.on("postgres_changes", { event: "*", schema: "public", table: "order_lines" }, loadOrders);
      channel.subscribe();
    }
  }, [logged]);

  // Aggiungi articolo da griglia
  const addGroupToCart = (righe: StockRow[]) => {
    const newCart = cart.filter(c => !righe.some(r => r.articolo === c.articolo && r.colore === c.colore));
    const toAdd: CartRow[] = [];
    righe.forEach(r => {
      const el = document.getElementById(`qty-${r.sku}`) as HTMLInputElement;
      const val = parseInt(el?.value || "0");
      if (val > 0) {
        toAdd.push({
          sku: r.sku,
          articolo: r.articolo,
          colore: r.colore,
          taglia: r.taglia,
          richiesti: val,
          prezzo: r.prezzo,
        });
      }
    });
    setCart([...newCart, ...toAdd]);
  };

  // Svuota gruppo dal carrello
  const clearGroup = (righe: StockRow[]) => {
    const newCart = cart.filter(c => !righe.some(r => r.articolo === c.articolo && r.colore === c.colore));
    setCart(newCart);
  };

  // Totali
  const totaleLordo = cart.reduce((sum, r) => sum + r.richiesti * r.prezzo, 0);
  const totaleNetto = totaleLordo * (1 - sconto / 100);

  // Invia ordine
  const sendOrder = async () => {
    const id = Date.now().toString();
    await supabase.from("orders").insert([{ id, customer, stato: "In attesa" }]);
    const rows = cart.map(r => ({
      order_id: id,
      sku: r.sku,
      articolo: r.articolo,
      colore: r.colore,
      taglia: r.taglia,
      richiesti: r.richiesti,
      prezzo: r.prezzo,
    }));
    await supabase.from("order_lines").insert(rows);
    setCart([]);
    alert("Ordine inviato");
  };

  // Conferma ordine (Magazzino)
  const confirmOrder = async (ord: Order) => {
    const righe = orderLines[ord.id] || [];
    for (const r of righe) {
      const el = document.getElementById(`conf-${ord.id}-${r.sku}`) as HTMLInputElement;
      const val = parseInt(el?.value || "0");
      await supabase.from("order_lines").update({ confermati: val }).eq("id", r.id);
      if (val > 0) {
        // Scala stock
        await supabase.rpc("decrementa_stock", { p_sku: r.sku, p_qty: val });
      }
    }
    await supabase.from("orders").update({ stato: "Confermato" }).eq("id", ord.id);
    alert("Ordine confermato");
  };

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Ordine cliente: ${customer}`, 10, 10);
    autoTable(doc, {
      head: [["Articolo", "Colore", "Taglia", "Quantità", "Prezzo", "Totale"]],
      body: cart.map(r => [r.articolo, r.colore, r.taglia, r.richiesti, r.prezzo, r.richiesti * r.prezzo]),
    });
    doc.text(`Totale: €${totaleNetto.toFixed(2)}`, 10, 280);
    doc.save("ordine.pdf");
  };

  // Export Excel
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(cart);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, "ordine.xlsx");
  };

  // Export CSV
  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(cart);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "ordine.csv");
  };

  if (!logged) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
        <img src="/mars3lo.png" className="w-40 mb-6" />
        <div className="bg-gray-900 p-6 rounded-xl">
          <h1 className="text-xl mb-4 text-center">Login</h1>
          <input className="mb-2 p-2 w-64 text-black" placeholder="ID" value={user} onChange={e => setUser(e.target.value)} />
          <input className="mb-2 p-2 w-64 text-black" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={handleLogin} className="w-64 bg-white text-black py-2 rounded">Entra</button>
        </div>
      </div>
    );
  }

  // --- SHOWROOM ---
  if (role === "showroom") {
    const gruppi = Object.values(
      stock.reduce((acc: any, r) => {
        const key = r.articolo + "|" + r.colore;
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      }, {})
    );

    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Showroom Centergross</h1>
        <input className="border p-2 mb-2 w-64" placeholder="Cliente" value={customer} onChange={e => setCustomer(e.target.value)} />
        <div className="grid gap-6">
          {gruppi.map((righe: StockRow[]) => (
            <div key={righe[0].articolo + righe[0].colore} className="border p-3 rounded-xl">
              <h2 className="font-bold text-lg text-left">{righe[0].articolo} {classify(righe[0].articolo)} – <span className="font-bold">{righe[0].colore}</span></h2>
              <table className="w-full text-left">
                <thead>
                  <tr>
                    {righe.map(r => <th key={r.sku}>{r.taglia}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {righe.map(r => (
                      <td key={r.sku}>
                        <input id={`qty-${r.sku}`} type="number" min={0} max={r.qty} className="w-16 border p-1" />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <div className="mt-2 flex gap-2">
                <button onClick={() => addGroupToCart(righe)} className="bg-black text-white px-3 py-1 rounded">Aggiungi</button>
                <button onClick={() => clearGroup(righe)} className="bg-red-500 text-white px-3 py-1 rounded">Svuota</button>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mt-6">Carrello</h2>
        <table className="w-full text-left border mt-2">
          <thead>
            <tr>
              <th>Articolo</th><th>Colore</th><th>Taglia</th><th>Qty</th><th>Prezzo</th><th>Totale</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((c, i) => (
              <tr key={i}>
                <td>{c.articolo}</td><td>{c.colore}</td><td>{c.taglia}</td>
                <td>{c.richiesti}</td><td>{c.prezzo}</td><td>{c.richiesti * c.prezzo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4">
          <input type="number" className="border p-2 w-24" value={sconto} onChange={e => setSconto(parseInt(e.target.value) || 0)} /> % Sconto
          <p className="mt-2">Totale netto: €{totaleNetto.toFixed(2)}</p>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={sendOrder} className="bg-green-600 text-white px-4 py-2 rounded">Invia ordine</button>
          <button onClick={exportPDF} className="bg-gray-800 text-white px-4 py-2 rounded">PDF</button>
          <button onClick={exportExcel} className="bg-gray-800 text-white px-4 py-2 rounded">Excel</button>
          <button onClick={exportCSV} className="bg-gray-800 text-white px-4 py-2 rounded">CSV</button>
        </div>
      </div>
    );
  }

  // --- MAGAZZINO ---
  if (role === "magazzino") {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Magazzino Napoli</h1>
        {orders.map(ord => (
          <div key={ord.id} className="border p-4 mb-4 rounded-xl">
            <h2 className="font-bold mb-2">Ordine {ord.id} – {ord.customer} – {ord.stato}</h2>
            <table className="w-full text-left border">
              <thead>
                <tr><th>Articolo</th><th>Colore</th><th>Taglia</th><th>Richiesti</th><th>Confermati</th></tr>
              </thead>
              <tbody>
                {(orderLines[ord.id] || []).map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.articolo}</td><td>{r.colore}</td><td>{r.taglia}</td>
                    <td>{r.richiesti}</td>
                    <td><input id={`conf-${ord.id}-${r.sku}`} type="number" defaultValue={r.richiesti} className="w-16 border p-1" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => confirmOrder(ord)} className="mt-2 bg-green-600 text-white px-4 py-1 rounded">Conferma ordine</button>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
