import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// 🔑 Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 📌 Tipi
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
  id?: number;
  order_id?: string;
  sku: string;
  articolo: string;
  taglia: string;
  colore: string;
  richiesti: number;
  confermati?: number;
  prezzo: number;
}

interface Order {
  id: string;
  created_at?: string;
  customer: string;
  stato: string;
  lines?: OrderLine[];
}

// 📌 Classificazione articoli
function classify(sku: string): string {
  const code = sku.toUpperCase();
  if (code.startsWith("G") && !code.startsWith("GB")) return "GIACCA";
  if (code.startsWith("GB")) return "GIUBBOTTO";
  if (code.startsWith("MG")) return "MAGLIA";
  if (code.startsWith("P") && !code.startsWith("PM")) return "PANTALONE";
  if (code.startsWith("PM")) return "PANTALONI FELPA";
  if (code.startsWith("C")) return "CAMICIA";
  return "ALTRO";
}

// 📌 App principale
export default function App() {
  const [role, setRole] = useState<"login" | "showroom" | "magazzino" | null>("login");
  const [stock, setStock] = useState<StockItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customer, setCustomer] = useState("");
  const [sconto, setSconto] = useState(0);
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [search, setSearch] = useState("");

  // 🔹 Carica stock da Supabase
  useEffect(() => {
    if (role === "showroom" || role === "magazzino") {
      loadStock();
      loadOrders();
    }
  }, [role]);

  async function loadStock() {
    const { data } = await supabase.from("stock").select("*");
    setStock(data as StockItem[]);
  }

  async function loadOrders() {
    const { data } = await supabase.from("orders").select("*, order_lines(*)").order("created_at", { ascending: false });
    setOrders(data as any);
  }

  // 🔹 Login
  const handleLogin = (id: string, pw: string) => {
    if (id === "Mars3loBo" && pw === "Francesco01") {
      setRole("showroom");
    } else if (id === "Mars3loNa" && pw === "Gbesse01") {
      setRole("magazzino");
    } else {
      alert("Credenziali non valide");
    }
  };

  // 🔹 Aggiungi al carrello
  const addToCart = (group: StockItem[], values: Record<string, number>) => {
    const lines: OrderLine[] = [];
    for (const g of group) {
      const qty = values[g.taglia] || 0;
      if (qty > 0) {
        lines.push({
          sku: g.sku,
          articolo: g.articolo,
          taglia: g.taglia,
          colore: g.colore,
          richiesti: qty,
          prezzo: g.prezzo,
        });
      }
    }
    if (lines.length > 0) setCart([...cart, ...lines]);
  };

  const clearGroup = (articolo: string, colore: string) => {
    setCart(cart.filter((c) => !(c.articolo === articolo && c.colore === colore)));
  };

  // 🔹 Invia ordine
  const sendOrder = async () => {
    if (!customer || cart.length === 0) return alert("Inserisci cliente e articoli");
    const orderId = crypto.randomUUID();
    const { error } = await supabase.from("orders").insert([{ id: orderId, customer, stato: "In attesa" }]);
    if (error) return alert("Errore ordine");

    const lines = cart.map((c) => ({ ...c, order_id: orderId }));
    await supabase.from("order_lines").insert(lines);
    setCart([]);
    alert("Ordine inviato!");
    loadOrders();
  };

  // 🔹 Conferma ordine
  const confirmOrder = async (order: Order, conferme: Record<number, number>) => {
    for (const line of order.lines || []) {
      const qtyConf = conferme[line.id!] ?? 0;
      await supabase.from("order_lines").update({ confermati: qtyConf }).eq("id", line.id!);
      await supabase.rpc("decrementa_stock", { p_sku: line.sku, p_qty: qtyConf });
    }
    await supabase.from("orders").update({ stato: "Confermato" }).eq("id", order.id);
    loadOrders();
    loadStock();
  };

  const annullaOrder = async (orderId: string) => {
    await supabase.from("orders").update({ stato: "Annullato" }).eq("id", orderId);
    loadOrders();
  };

  // 📌 Login page
  if (role === "login") {
    const [id, setId] = useState("");
    const [pw, setPw] = useState("");
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="bg-gray-900 p-8 rounded shadow-md w-80 text-center">
          <img src="/public/mars3lo.png" alt="Mars3lo" className="h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-4">Accesso</h1>
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="ID" className="border p-2 mb-2 w-full text-black" />
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className="border p-2 mb-4 w-full text-black" />
          <button onClick={() => handleLogin(id, pw)} className="bg-green-600 text-white px-4 py-2 rounded w-full">Login</button>
        </div>
      </div>
    );
  }

  // 📌 Showroom
  if (role === "showroom") {
    const grouped = stock.reduce((acc: Record<string, StockItem[]>, item) => {
      const key = item.articolo + "_" + item.colore;
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});

    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Showroom Centergross</h1>
        <div className="flex gap-4 mb-4">
          <input placeholder="Cliente" value={customer} onChange={(e) => setCustomer(e.target.value)} className="border p-2" />
          <input type="number" placeholder="Sconto %" value={sconto} onChange={(e) => setSconto(Number(e.target.value))} className="border p-2 w-24" />
          <input placeholder="Cerca codice o colore" value={search} onChange={(e) => setSearch(e.target.value)} className="border p-2 flex-1" />
        </div>

        {Object.values(grouped)
          .filter((g) =>
            g[0].articolo.toLowerCase().includes(search.toLowerCase()) ||
            g[0].colore.toLowerCase().includes(search.toLowerCase())
          )
          .map((group) => (
            <GroupRow key={group[0].sku} group={group} addToCart={addToCart} clearGroup={clearGroup} />
          ))}

        <h2 className="text-xl font-bold mt-6">Carrello</h2>
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th>Articolo</th><th>Taglia</th><th>Colore</th><th>Q.tà</th><th>Prezzo</th><th>Totale</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((c, i) => (
              <tr key={i} className="border-t">
                <td>{c.articolo}</td>
                <td>{c.taglia}</td>
                <td>{c.colore}</td>
                <td>{c.richiesti}</td>
                <td>€ {c.prezzo.toFixed(2)}</td>
                <td>€ {(c.prezzo * c.richiesti).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4">
          Totale Lordo: € {cart.reduce((sum, c) => sum + c.prezzo * c.richiesti, 0).toFixed(2)} <br />
          Sconto: {sconto}% <br />
          Totale Imponibile: € {(cart.reduce((sum, c) => sum + c.prezzo * c.richiesti, 0) * (1 - sconto / 100)).toFixed(2)}
        </div>
        <button onClick={sendOrder} className="bg-blue-600 text-white px-4 py-2 mt-4 rounded">Invia ordine</button>
      </div>
    );
  }

  // 📌 Magazzino
  if (role === "magazzino") {
    return (
      <div>
        <header className="bg-black h-20 flex flex-col items-center justify-center mb-4">
          <img src="/public/mars3lo.png" alt="Mars3lo" className="h-10 mb-1" />
          <span className="text-white font-bold tracking-wide">MARS3LO B2B</span>
        </header>
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Ordini ricevuti</h1>
          {orders.map((o) => (
            <div key={o.id} className="border p-2 mb-2">
              <div className="font-bold">{o.customer} – {o.stato}</div>
              <table className="w-full border mt-2">
                <thead>
                  <tr className="bg-gray-200"><th>Articolo</th><th>Taglia</th><th>Colore</th><th>Richiesti</th><th>Confermati</th></tr>
                </thead>
                <tbody>
                  {o.lines?.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td>{l.articolo}</td>
                      <td>{l.taglia}</td>
                      <td>{l.colore}</td>
                      <td>{l.richiesti}</td>
                      <td><input type="number" defaultValue={l.richiesti} className="border w-16" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex gap-2 mt-2">
                <button onClick={() => confirmOrder(o, {})} className="bg-green-600 text-white px-3 py-1 rounded">Conferma</button>
                <button onClick={() => annullaOrder(o.id)} className="bg-red-600 text-white px-3 py-1 rounded">Annulla</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 📌 Fallback
  return <div className="text-center text-red-600 p-10">Errore: nessuna pagina caricata</div>;
}

// 🔹 Componenti di supporto
function GroupRow({ group, addToCart, clearGroup }: { group: StockItem[]; addToCart: Function; clearGroup: Function }) {
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
