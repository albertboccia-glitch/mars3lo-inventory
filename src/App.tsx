import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// 🔑 Supabase keys (ambienti Vercel)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 📌 Types
interface StockItem {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
}

interface OrderLine {
  sku: string;
  articolo: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
}

interface Order {
  id: string;
  customer: string;
  sconto: number;
  stato: string;
  created_at: string;
  lines: OrderLine[];
}

// 🔐 Login screen
function LoginScreen({ onLogin }: { onLogin: (role: string) => void }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (id === "Mars3loBo" && pw === "Francesco01") {
      onLogin("showroom");
    } else if (id === "Mars3loNa" && pw === "Gbesse01") {
      onLogin("magazzino");
    } else {
      alert("Credenziali non valide");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="text-center">
        <img src="/public/public/mars3lo.png" alt="logo" className="mx-auto mb-6 w-40" />
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg">
          <input
            type="text"
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="block mb-3 w-64 p-2 border"
          />
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="block mb-3 w-64 p-2 border"
          />
          <button type="submit" className="bg-black text-white px-4 py-2 rounded">
            Accedi
          </button>
        </form>
      </div>
    </div>
  );
}

// 🛒 Showroom (Bologna)
function ShowroomApp({ onLogout }: { onLogout: () => void }) {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [sconto, setSconto] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // fetch stock
  useEffect(() => {
    const fetchStock = async () => {
      const { data } = await supabase.from("stock").select("*");
      if (data) setStock(data as StockItem[]);
    };
    fetchStock();
  }, []);

  const categorie: Record<string, string> = {
    G: "Giacche",
    P: "Pantaloni",
    GB: "Giubbotti",
    MG: "Maglie",
    C: "Camicie",
    PM: "Pantaloni Felpa",
  };

  const getCategoria = (sku: string) => {
    if (sku.startsWith("GB")) return "Giubbotti";
    if (sku.startsWith("MG")) return "Maglie";
    if (sku.startsWith("PM")) return "Pantaloni Felpa";
    if (sku.startsWith("G")) return "Giacche";
    if (sku.startsWith("P")) return "Pantaloni";
    if (sku.startsWith("C")) return "Camicie";
    return "Altro";
  };

  const filtered = stock.filter(
    (s) =>
      (filter === "all" || getCategoria(s.sku) === filter) &&
      (s.articolo.toLowerCase().includes(search.toLowerCase()) ||
        s.sku.toLowerCase().includes(search.toLowerCase()) ||
        s.colore.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (item: StockItem, qty: number) => {
    if (qty <= 0) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.sku === item.sku && l.taglia === item.taglia);
      if (existing) {
        return prev.map((l) =>
          l.sku === item.sku && l.taglia === item.taglia
            ? { ...l, qty: qty }
            : l
        );
      }
      return [...prev, { ...item, qty }];
    });
  };

  const removeFromCart = (sku: string, taglia: string) => {
    setCart((prev) => prev.filter((l) => !(l.sku === sku && l.taglia === taglia)));
  };

  const clearCart = () => setCart([]);

  const total = cart.reduce((sum, l) => sum + l.qty * l.prezzo, 0);
  const totalScontato = total - total * (sconto / 100);

  const sendOrder = async () => {
    if (!customer) {
      alert("Inserisci cliente");
      return;
    }
    const orderId = Date.now().toString();
    await supabase.from("orders").insert([{ id: orderId, customer, sconto, stato: "In attesa" }]);
    const lines = cart.map((l) => ({
      order_id: orderId,
      sku: l.sku,
      articolo: l.articolo,
      taglia: l.taglia,
      colore: l.colore,
      richiesti: l.qty,
      prezzo: l.prezzo,
    }));
    await supabase.from("order_lines").insert(lines);
    alert("Ordine inviato");
    clearCart();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Ordine cliente: ${customer}`, 14, 15);
    autoTable(doc, {
      head: [["Articolo", "Taglia", "Colore", "Q.tà", "Prezzo", "Totale"]],
      body: cart.map((l) => [
        l.articolo,
        l.taglia,
        l.colore,
        l.qty,
        `€${l.prezzo}`,
        `€${l.qty * l.prezzo}`,
      ]),
    });
    doc.text(`Totale: €${total}`, 14, doc.lastAutoTable.finalY + 10);
    doc.text(`Totale scontato: €${totalScontato}`, 14, doc.lastAutoTable.finalY + 20);
    doc.save("ordine.pdf");
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(cart);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, "ordine.xlsx");
  };

  return (
    <div>
      <div className="bg-black text-center py-2 mb-4">
        <img src="/public/public/mars3lo.png" alt="logo" className="mx-auto w-24" />
        <div className="text-white font-bold">MARS3LO B2B - Showroom Centergross</div>
      </div>

      <div className="p-4">
        <div className="flex space-x-4 mb-4">
          <input
            placeholder="Cliente"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="border p-2"
          />
          <label className="flex items-center space-x-2">
            <span>Sconto</span>
            <input
              type="number"
              value={sconto}
              onChange={(e) => setSconto(parseFloat(e.target.value))}
              className="border p-2 w-20"
            />
            <span>%</span>
          </label>
          <input
            placeholder="Cerca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border p-2 flex-1"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border p-2"
          >
            <option value="all">Tutte</option>
            {Object.values(categorie).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <table className="w-full border mb-6">
          <thead>
            <tr className="bg-gray-200">
              <th>Articolo</th>
              <th>Taglia</th>
              <th>Colore</th>
              <th>Disponibili</th>
              <th>Prezzo</th>
              <th>Ordina</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.sku + item.taglia}>
                <td>{item.articolo}</td>
                <td>{item.taglia}</td>
                <td>{item.colore}</td>
                <td>{item.qty}</td>
                <td>€{item.prezzo}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max={item.qty}
                    defaultValue={0}
                    onBlur={(e) => addToCart(item, parseInt(e.target.value))}
                    className="w-16 border p-1"
                  />
                </td>
                <td>
                  <button
                    className="bg-red-500 text-white px-2 py-1 rounded"
                    onClick={() => removeFromCart(item.sku, item.taglia)}
                  >
                    Svuota
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-lg font-bold mb-2">Ordine</h2>
        <table className="w-full border mb-4">
          <thead>
            <tr className="bg-gray-200">
              <th>Articolo</th>
              <th>Taglia</th>
              <th>Colore</th>
              <th>Q.tà</th>
              <th>Prezzo</th>
              <th>Totale</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((l) => (
              <tr key={l.sku + l.taglia}>
                <td>{l.articolo}</td>
                <td>{l.taglia}</td>
                <td>{l.colore}</td>
                <td>{l.qty}</td>
                <td>€{l.prezzo}</td>
                <td>€{l.qty * l.prezzo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mb-2">Totale: €{total}</div>
        <div className="mb-2">Totale scontato: €{totalScontato}</div>
        <div className="space-x-2">
          <button onClick={clearCart} className="bg-gray-500 text-white px-4 py-2 rounded">
            Svuota Ordine
          </button>
          <button onClick={sendOrder} className="bg-green-600 text-white px-4 py-2 rounded">
            Invia Ordine
          </button>
          <button onClick={exportPDF} className="bg-blue-600 text-white px-4 py-2 rounded">
            PDF
          </button>
          <button onClick={exportExcel} className="bg-yellow-600 text-white px-4 py-2 rounded">
            Excel
          </button>
        </div>
      </div>
    </div>
  );
}

// 📦 Magazzino (Napoli)
function MagazzinoApp({ onLogout }: { onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: ords } = await supabase.from("orders").select("*");
      if (ords) {
        const withLines: Order[] = [];
        for (const o of ords) {
          const { data: lines } = await supabase.from("order_lines").select("*").eq("order_id", o.id);
          withLines.push({ ...(o as any), lines: lines || [] });
        }
        setOrders(withLines);
      }
    };
    fetchOrders();

    // realtime
    const channel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, fetchOrders)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const confermaOrdine = async (order: Order) => {
    await supabase.from("orders").update({ stato: "Confermato" }).eq("id", order.id);
    alert("Ordine confermato");
  };

  const annullaOrdine = async (order: Order) => {
    await supabase.from("orders").update({ stato: "Annullato" }).eq("id", order.id);
    alert("Ordine annullato");
  };

  return (
    <div>
      <div className="bg-black text-center py-2 mb-4">
        <img src="/public/public/mars3lo.png" alt="logo" className="mx-auto w-24" />
        <div className="text-white font-bold">MARS3LO B2B - Magazzino Napoli</div>
      </div>
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">Ordini ricevuti</h2>
        {orders.map((o) => (
          <div key={o.id} className="border p-3 mb-3">
            <div className="flex justify-between mb-2">
              <div>
                <strong>{o.customer}</strong> – Stato: {o.stato}
              </div>
              <div>
                <button
                  onClick={() => confermaOrdine(o)}
                  className="bg-green-600 text-white px-3 py-1 rounded mr-2"
                >
                  Conferma
                </button>
                <button
                  onClick={() => annullaOrdine(o)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Annulla
                </button>
              </div>
            </div>
            <table className="w-full border">
              <thead>
                <tr className="bg-gray-200">
                  <th>Articolo</th>
                  <th>Taglia</th>
                  <th>Colore</th>
                  <th>Richiesti</th>
                  <th>Prezzo</th>
                </tr>
              </thead>
              <tbody>
                {o.lines.map((l) => (
                  <tr key={l.sku + l.taglia}>
                    <td>{l.articolo}</td>
                    <td>{l.taglia}</td>
                    <td>{l.colore}</td>
                    <td>{l.richiesti}</td>
                    <td>€{l.prezzo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

// 🌟 App principale
export default function App() {
  const [role, setRole] = useState("login");

  if (role === "login") return <LoginScreen onLogin={setRole} />;
  if (role === "showroom") return <ShowroomApp onLogout={() => setRole("login")} />;
  if (role === "magazzino") return <MagazzinoApp onLogout={() => setRole("login")} />;

  return <div className="p-10 text-red-600">Errore ruolo: {role}</div>;
}
