import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

// 🔹 CONFIG SUPABASE
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🔹 TIPI
type StockRow = {
  sku: string;
  articolo: string;
  categoria: string;
  colore: string;
  taglia: string;
  qty: number;
  prezzo: number;
};
type OrderLine = {
  sku: string;
  articolo: string;
  colore: string;
  taglia: string;
  qty: number;
  prezzo: number;
};
type Order = {
  id: string;
  customer: string;
  sconto: number;
  stato: string;
  lines: OrderLine[];
};

// 🔹 CREDENZIALI FISSE
const USERS = [
  { id: "Mars3loBo", pw: "Francesco01", role: "showroom" },
  { id: "Mars3loNa", pw: "Gbesse01", role: "magazzino" },
];

// 🔹 CLASSIFICAZIONE
function classify(code: string): string {
  const lower = code.toLowerCase();
  if (lower.startsWith("g")) return "Giacche";
  if (lower.startsWith("gb")) return "Giubbotti";
  if (lower.startsWith("mg")) return "Maglie";
  if (lower.startsWith("pm")) return "Pantaloni Felpa";
  if (lower.startsWith("p")) return "Pantaloni";
  if (lower.startsWith("c")) return "Camicie";
  return "Altro";
}

// 🔹 COMPONENTE PRINCIPALE
export default function App() {
  const [role, setRole] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [sconto, setSconto] = useState(0);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");

  // 🔹 LOGIN
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loginError, setLoginError] = useState("");

  function handleLogin() {
    const u = USERS.find((x) => x.id === id && x.pw === pw);
    if (u) {
      setRole(u.role);
      loadStock();
      loadOrders();
    } else {
      setLoginError("Credenziali non valide");
    }
  }

  // 🔹 LOAD
  async function loadStock() {
    const { data } = await supabase.from("stock").select("*");
    setStock((data || []) as StockRow[]);
  }
  async function loadOrders() {
    const { data } = await supabase.from("orders").select("*");
    if (data) {
      const withLines: Order[] = [];
      for (const o of data) {
        const { data: lines } = await supabase
          .from("order_lines")
          .select("*")
          .eq("order_id", o.id);
        withLines.push({
          id: o.id,
          customer: o.customer,
          sconto: o.sconto,
          stato: o.stato,
          lines: (lines || []) as OrderLine[],
        });
      }
      setOrders(withLines);
    }
  }

  // 🔹 SHOWROOM → aggiungi al carrello
  function addToCart(group: { articolo: string; colore: string; prezzo: number }, selections: Record<string, number>) {
    const newCart = [...cart];
    for (const [taglia, qty] of Object.entries(selections)) {
      if (qty > 0) {
        const sku = `${group.articolo}-${group.colore}-${taglia}`;
        const existing = newCart.find((c) => c.sku === sku);
        if (existing) {
          existing.qty = qty; // 🔹 sempre ultima riga, non accumula
        } else {
          newCart.push({
            sku,
            articolo: group.articolo,
            colore: group.colore,
            taglia,
            qty,
            prezzo: group.prezzo,
          });
        }
      }
    }
    setCart(newCart);
  }

  function removeLine(sku: string) {
    setCart(cart.filter((c) => c.sku !== sku));
  }
  function clearCart() {
    setCart([]);
  }

  // 🔹 CALCOLI
  const totale = cart.reduce((sum, c) => sum + c.qty * c.prezzo, 0);
  const totaleScontato = totale * (1 - sconto / 100);

  // 🔹 ORDINI
  async function sendOrder() {
    if (!customer || cart.length === 0) return alert("Cliente o carrello vuoto");
    const id = Date.now().toString();
    await supabase.from("orders").insert([
      { id, customer, sconto, stato: "In attesa" },
    ]);
    for (const c of cart) {
      await supabase.from("order_lines").insert([
        {
          order_id: id,
          sku: c.sku,
          articolo: c.articolo,
          colore: c.colore,
          taglia: c.taglia,
          richiesti: c.qty,
          prezzo: c.prezzo,
        },
      ]);
    }
    setCart([]);
    alert("Ordine inviato!");
    loadOrders();
  }

  async function confirmOrder(order: Order) {
    for (const l of order.lines) {
      await supabase
        .from("stock")
        .update({ qty: l.qty })
        .eq("sku", l.sku);
    }
    await supabase.from("orders").update({ stato: "Confermato" }).eq("id", order.id);
    loadStock();
    loadOrders();
  }

  async function cancelOrder(order: Order) {
    await supabase.from("orders").update({ stato: "Annullato" }).eq("id", order.id);
    loadOrders();
  }

  // 🔹 PDF
  function exportPDF() {
    const doc = new jsPDF();
    doc.text("Ordine Cliente: " + customer, 10, 10);
    const rows = cart.map((c) => [
      c.articolo,
      c.colore,
      c.taglia,
      c.qty,
      c.prezzo,
      c.qty * c.prezzo,
    ]);
    (doc as any).autoTable({
      head: [["Articolo", "Colore", "Taglia", "Q.tà", "Prezzo", "Totale"]],
      body: rows,
    });
    doc.text(`Totale: €${totale.toFixed(2)}`, 10, 280);
    doc.text(`Totale Scontato: €${totaleScontato.toFixed(2)}`, 10, 290);
    doc.save("ordine.pdf");
  }

  // 🔹 EXCEL
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(cart);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, "ordine.xlsx");
  }

  // 🔹 RENDER
  if (!role) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <img src="/public/public/mars3lo.png" className="w-40 mb-6" />
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg w-80">
          <h2 className="text-white text-xl mb-4 text-center">Login</h2>
          <input className="w-full mb-2 p-2" placeholder="ID" value={id} onChange={(e) => setId(e.target.value)} />
          <input type="password" className="w-full mb-2 p-2" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          {loginError && <p className="text-red-500">{loginError}</p>}
          <button onClick={handleLogin} className="bg-white text-black w-full py-2 rounded mt-2">Accedi</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Barra superiore */}
      <div className="bg-black flex flex-col items-center py-2">
        <img src="/public/public/mars3lo.png" className="h-12" />
        <span className="text-white font-bold">MARS3LO B2B</span>
      </div>

      {role === "showroom" && (
        <div className="p-4">
          <div className="flex items-center space-x-2 mb-4">
            <input placeholder="Cliente" value={customer} onChange={(e) => setCustomer(e.target.value)} className="p-2 border" />
            <span>Sconto</span>
            <input type="number" value={sconto} onChange={(e) => setSconto(Number(e.target.value))} className="w-16 p-2 border" /> %
          </div>
          <div className="flex space-x-2 mb-4">
            <input placeholder="Cerca..." value={search} onChange={(e) => setSearch(e.target.value)} className="p-2 border flex-1" />
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="p-2 border">
              <option value="">Tutte</option>
              <option value="Giacche">Giacche</option>
              <option value="Giubbotti">Giubbotti</option>
              <option value="Maglie">Maglie</option>
              <option value="Pantaloni">Pantaloni</option>
              <option value="Pantaloni Felpa">Pantaloni Felpa</option>
              <option value="Camicie">Camicie</option>
            </select>
          </div>
          {/* 🔹 Griglia */}
          {Object.values(
            stock.reduce((acc: any, row) => {
              const key = row.articolo + "-" + row.colore;
              if (!acc[key]) acc[key] = { articolo: row.articolo, colore: row.colore, prezzo: row.prezzo, sizes: {} };
              acc[key].sizes[row.taglia] = row.qty;
              return acc;
            }, {})
          )
            .filter((g: any) => (!search || g.articolo.includes(search)) && (!filterCat || classify(g.articolo) === filterCat))
            .map((g: any) => {
              const [quant, setQuant] = useState<Record<string, number>>({});
              return (
                <div key={g.articolo + g.colore} className="border p-2 mb-4">
                  <div className="font-bold">{g.articolo} {classify(g.articolo)} - <span className="font-bold">{g.colore}</span> (€{g.prezzo})</div>
                  <div className="flex space-x-2 mt-2">
                    {Object.entries(g.sizes).map(([taglia, qty]: any) => (
                      <div key={taglia} className="flex flex-col items-center">
                        <span>{taglia}</span>
                        <span className="text-sm text-gray-500">Disp: {qty}</span>
                        <input type="number" min="0" className="w-16 p-1 border" value={quant[taglia] || ""} onChange={(e) => setQuant({ ...quant, [taglia]: Number(e.target.value) })} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 space-x-2">
                    <button onClick={() => addToCart(g, quant)} className="bg-green-600 text-white px-3 py-1 rounded">Aggiungi</button>
                    <button onClick={() => setQuant({})} className="bg-red-600 text-white px-3 py-1 rounded">Svuota</button>
                  </div>
                </div>
              );
            })}
          {/* Carrello */}
          <h2 className="font-bold mt-6">Ordine</h2>
          <table className="w-full border mt-2">
            <thead>
              <tr className="bg-gray-200">
                <th>Articolo</th><th>Taglia</th><th>Colore</th><th>Q.tà</th><th>Prezzo</th><th>Totale</th><th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((c) => (
                <tr key={c.sku}>
                  <td>{c.articolo}</td>
                  <td>{c.taglia}</td>
                  <td>{c.colore}</td>
                  <td>{c.qty}</td>
                  <td>€{c.prezzo}</td>
                  <td>€{c.qty * c.prezzo}</td>
                  <td><button onClick={() => removeLine(c.sku)} className="text-red-600">X</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2">Totale: €{totale.toFixed(2)} – Totale scontato: €{totaleScontato.toFixed(2)}</div>
          <div className="mt-4 space-x-2">
            <button onClick={sendOrder} className="bg-blue-600 text-white px-4 py-2 rounded">Invia Ordine</button>
            <button onClick={exportPDF} className="bg-gray-600 text-white px-4 py-2 rounded">PDF</button>
            <button onClick={exportExcel} className="bg-gray-600 text-white px-4 py-2 rounded">Excel</button>
            <button onClick={clearCart} className="bg-red-600 text-white px-4 py-2 rounded">Svuota tutto</button>
          </div>
        </div>
      )}

      {role === "magazzino" && (
        <div className="p-4">
          <h2 className="font-bold mb-4">Ordini ricevuti</h2>
          {orders.map((o) => (
            <div key={o.id} className="border p-2 mb-4">
              <div className="font-bold">Cliente: {o.customer} – Stato: {o.stato}</div>
              <table className="w-full border mt-2">
                <thead><tr><th>Articolo</th><th>Taglia</th><th>Colore</th><th>Q.tà</th><th>Prezzo</th></tr></thead>
                <tbody>
                  {o.lines.map((l) => (
                    <tr key={l.sku + l.taglia}>
                      <td>{l.articolo}</td><td>{l.taglia}</td><td>{l.colore}</td><td>{l.qty}</td><td>€{l.prezzo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 space-x-2">
                <button onClick={() => confirmOrder(o)} className="bg-green-600 text-white px-3 py-1 rounded">Conferma</button>
                <button onClick={() => cancelOrder(o)} className="bg-red-600 text-white px-3 py-1 rounded">Annulla</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
