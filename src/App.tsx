import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// 🔑 Config Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

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

// 🔹 Classificazione
function classify(sku: string): string {
  const up = sku.toUpperCase();
  if (/^GB\d+/.test(up)) return "Giubbotti";
  if (/^G\d+/.test(up)) return "Giacche";
  if (/^P\d+/.test(up)) return "Pantaloni";
  if (/^MG\d+/.test(up) || /^M\d+/.test(up)) return "Maglie";
  return "Altro";
}

export default function App() {
  const [role, setRole] = useState<"login" | "showroom" | "magazzino" | null>(
    "login"
  );
  const [stock, setStock] = useState<Stock[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(false);

  // 🔹 Login fisso
  const handleLogin = (id: string, pw: string) => {
    if (id === "Mars3loBo" && pw === "Francesco01") setRole("showroom");
    else if (id === "Mars3loNa" && pw === "Gbesse01") setRole("magazzino");
    else alert("Credenziali errate");
  };

  // 🔹 Carica stock
  useEffect(() => {
    if (role === "showroom" || role === "magazzino") {
      setLoading(true);
      supabase
        .from("stock")
        .select("*")
        .then(({ data }) => {
          if (data) setStock(data as Stock[]);
          setLoading(false);
        });

      // ascolta realtime stock
      supabase
        .channel("stock_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "stock" },
          () => {
            supabase.from("stock").select("*").then(({ data }) => {
              if (data) setStock(data as Stock[]);
            });
          }
        )
        .subscribe();

      // ascolta ordini
      supabase
        .channel("orders_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => {
            loadOrders();
          }
        )
        .subscribe();
    }
  }, [role]);

  async function loadOrders() {
    let { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (data) setOrders(data as Order[]);
    let { data: linesData } = await supabase.from("order_lines").select("*");
    if (linesData) setLines(linesData as OrderLine[]);
  }

  // 🔹 Aggiungi al carrello
  function addToCart(group: Stock[], values: Record<string, number>) {
    let newItems: OrderLine[] = [];
    for (const s of group) {
      const qty = values[s.taglia] || 0;
      if (qty > 0) {
        newItems.push({
          id: Date.now(),
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
    }
    setCart(newItems); // 🔑 Sovrascrive con ultima riga
  }

  // 🔹 Svuota carrello
  function clearCart() {
    setCart([]);
  }

  // 🔹 Invia ordine
  async function sendOrder() {
    if (!customer) {
      alert("Inserisci cliente");
      return;
    }
    const orderId = "ORD" + Date.now();
    await supabase.from("orders").insert([{ id: orderId, customer, stato: "In attesa" }]);
    const linesInsert = cart.map((c) => ({ ...c, order_id: orderId }));
    await supabase.from("order_lines").insert(linesInsert);
    setCart([]);
    alert("Ordine inviato");
  }

  // 🔹 Conferma ordine lato Napoli
  async function confirmOrder(orderId: string) {
    const orderLines = lines.filter((l) => l.order_id === orderId);
    for (const l of orderLines) {
      await supabase.rpc("decrementa_stock", { p_sku: l.sku, p_qty: l.richiesti });
      await supabase
        .from("order_lines")
        .update({ confermati: l.richiesti })
        .eq("id", l.id);
    }
    await supabase.from("orders").update({ stato: "Confermato" }).eq("id", orderId);
  }

  // 🔹 Annulla ordine
  async function cancelOrder(orderId: string) {
    await supabase.from("orders").update({ stato: "Annullato" }).eq("id", orderId);
  }

  // 🔹 Modifica ordine (reset stato)
  async function modifyOrder(orderId: string) {
    await supabase.from("orders").update({ stato: "In attesa" }).eq("id", orderId);
  }

  // 🔹 Vista login
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

  // 🔹 Vista showroom
  if (role === "showroom") {
    if (loading) return <div className="text-center p-10">Caricamento…</div>;
    const grouped = Object.values(
      stock.reduce((acc: any, s) => {
        const key = s.articolo + "-" + s.colore;
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
      }, {})
    ) as Stock[][];

    return (
      <div className="p-4">
        <div className="flex gap-4 items-center mb-4">
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Cliente"
            className="border p-2"
          />
          <label className="font-semibold">Sconto %</label>
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="border p-2 w-20"
          />
        </div>

        {grouped.map((g, i) => (
          <GroupRow key={i} group={g} addToCart={addToCart} clearGroup={() => {}} />
        ))}

        <h2 className="text-lg font-bold mt-4">Carrello</h2>
        {cart.map((c, i) => (
          <div key={i} className="border p-2 my-1">
            {c.articolo} {c.colore} {c.taglia} – {c.richiesti} pz x €{c.prezzo}
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <button onClick={sendOrder} className="bg-blue-600 text-white px-3 py-1 rounded">Invia Ordine</button>
          <button onClick={clearCart} className="bg-gray-500 text-white px-3 py-1 rounded">Svuota</button>
        </div>
      </div>
    );
  }

  // 🔹 Vista magazzino
  if (role === "magazzino") {
    if (loading) return <div className="text-center p-10">Caricamento…</div>;
    return (
      <div>
        <header className="bg-black h-20 flex flex-col items-center justify-center mb-4">
          <img src="/public/mars3lo.png" alt="Mars3lo" className="h-10 mb-1" />
          <span className="text-white font-bold tracking-wide">MARS3LO B2B</span>
        </header>

        <div className="p-4">
          <h1 className="text-xl font-bold mb-4">Ordini ricevuti</h1>
          {orders.map((o) => (
            <div key={o.id} className="border p-2 mb-2">
              <div>
                <b>{o.customer}</b> – Stato: {o.stato}
              </div>
              <div>
                {lines
                  .filter((l) => l.order_id === o.id)
                  .map((l) => (
                    <div key={l.id}>
                      {l.articolo} {l.colore} {l.taglia} → {l.richiesti} pz
                    </div>
                  ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => confirmOrder(o.id)} className="bg-green-600 text-white px-3 py-1 rounded">Conferma</button>
                <button onClick={() => cancelOrder(o.id)} className="bg-red-600 text-white px-3 py-1 rounded">Annulla</button>
                <button onClick={() => modifyOrder(o.id)} className="bg-yellow-600 text-white px-3 py-1 rounded">Modifica</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 🔹 fallback
  return <div className="text-center p-10 text-red-600">Errore: nessuna pagina caricata</div>;
}

// 🔹 Griglia articoli
function GroupRow({ group, addToCart, clearGroup }: { group: Stock[]; addToCart: Function; clearGroup: Function }) {
  const [values, setValues] = useState<Record<string, number>>({});
  const g0 = group[0];
  return (
    <div className="border p-2 mb-2">
      <div className="font-bold">
        {g0.sku} – {classify(g0.sku)} – {g0.colore} – Prezzo € {g0.prezzo}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {group.map((s) => (
          <div key={s.taglia} className="border p-2 text-center">
            <div>{s.taglia}</div>
            <div className="text-xs text-gray-500">Disp: {s.qty}</div>
            <input
              type="number"
              min={0}
              max={s.qty}
              defaultValue={0}
              onChange={(e) => setValues({ ...values, [s.taglia]: Number(e.target.value) })}
              className="border w-16"
            />
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
