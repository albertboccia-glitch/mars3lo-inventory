import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- credenziali fisse ---
const USERS = [
  { id: "Mars3loBo", pass: "Francesco01", role: "showroom" },
  { id: "Mars3loNa", pass: "Gbesse01", role: "magazzino" },
];

// categorie leggibili
const CATEGORIE_LABELS: Record<string, string> = {
  G: "Giacche",
  P: "Pantaloni",
  GB: "Giubbotti",
  MG: "Maglie",
  PM: "Pantaloni Felpa",
  C: "Camicie",
};

interface StockRow {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
}

interface CartRow {
  sku: string;
  articolo: string;
  colore: string;
  taglia: string;
  richiesti: number;
  prezzo: number;
}

export default function App() {
  const [user, setUser] = useState<{ id: string; role: string } | null>(null);
  const [id, setId] = useState("");
  const [pass, setPass] = useState("");
  const [stock, setStock] = useState<StockRow[]>([]);
  const [carrello, setCarrello] = useState<CartRow[]>([]);
  const [ordini, setOrdini] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"griglia" | "lista">("griglia");
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);

  // --- login ---
  const handleLogin = () => {
    const u = USERS.find((u) => u.id === id && u.pass === pass);
    if (u) setUser({ id: u.id, role: u.role });
    else alert("Credenziali errate");
  };

  // --- load stock ---
  useEffect(() => {
    if (!user) return;
    const fetchStock = async () => {
      const { data, error } = await supabase.from("stock").select("*");
      if (!error && data) setStock(data as StockRow[]);
    };
    fetchStock();

    // realtime stock
    const ch = supabase
      .channel("stock-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock" }, (p) => {
        fetchStock();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  // --- load ordini (solo magazzino) ---
  useEffect(() => {
    if (!user || user.role !== "magazzino") return;
    const fetchOrdini = async () => {
      const { data, error } = await supabase.from("orders").select("*, order_lines(*)").order("created_at", { ascending: false });
      if (!error && data) setOrdini(data);
    };
    fetchOrdini();

    const ch = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrdini())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_lines" }, () => fetchOrdini())
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  // --- aggiungi al carrello ---
  const addToCart = (r: CartRow) => {
    setCarrello((prev) => {
      const idx = prev.findIndex((x) => x.sku === r.sku);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx].richiesti += r.richiesti;
        return clone;
      }
      return [...prev, r];
    });
  };

  const removeFromCart = (sku: string) => {
    setCarrello((prev) => prev.filter((r) => r.sku !== sku));
  };
  const clearCart = () => setCarrello([]);

  // --- invia ordine showroom ---
  const inviaOrdine = async () => {
    if (!cliente) {
      alert("Inserisci cliente");
      return;
    }
    const orderId = Date.now().toString();
    const { error } = await supabase.from("orders").insert([{ id: orderId, customer: cliente, stato: "In attesa" }]);
    if (error) {
      alert("Errore ordine");
      return;
    }
    const righe = carrello.map((r) => ({
      order_id: orderId,
      sku: r.sku,
      articolo: r.articolo,
      taglia: r.taglia,
      colore: r.colore,
      richiesti: r.richiesti,
      prezzo: r.prezzo,
    }));
    await supabase.from("order_lines").insert(righe);
    alert("Ordine inviato al Magazzino");
    clearCart();
  };

  // --- conferma magazzino ---
  const confermaOrdine = async (orderId: string, righe: any[]) => {
    for (const r of righe) {
      const confermati = parseInt((document.getElementById(`conf-${r.id}`) as HTMLInputElement).value) || 0;
      await supabase.from("order_lines").update({ confermati }).eq("id", r.id);
      if (confermati > 0) {
        await supabase.rpc("decrementa_stock", { p_sku: r.sku, p_qty: confermati });
      }
    }
    await supabase.from("orders").update({ stato: "Confermato" }).eq("id", orderId);
  };

  // --- export PDF ---
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Ordine cliente: " + cliente, 10, 10);
    const rows = carrello.map((r) => [r.articolo, r.colore, r.taglia, r.richiesti, r.prezzo.toFixed(2), (r.richiesti * r.prezzo).toFixed(2)]);
    autoTable(doc, { head: [["Articolo", "Colore", "Taglia", "Qta", "Prezzo", "Totale"]], body: rows });
    doc.save("ordine.pdf");
  };

  // --- export Excel ---
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(carrello);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, "ordine.xlsx");
  };

  // --- filtro stock ---
  const stockFiltrato = stock.filter((r) => {
    if (filtroCategoria && r.categoria !== filtroCategoria) return false;
    if (search && !r.articolo.toLowerCase().includes(search.toLowerCase()) && !r.sku.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  // --- login page ---
  if (!user)
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <img src="/public/mars3lo.png" alt="Mars3lo Logo" className="mx-auto w-32 mb-4" />
          <h1 className="text-2xl mb-4">Accesso Mars3lo</h1>
          <input className="border p-2 text-black mb-2" placeholder="ID" value={id} onChange={(e) => setId(e.target.value)} />
          <br />
          <input
            className="border p-2 text-black mb-2"
            placeholder="Password"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <br />
          <button className="bg-white text-black px-4 py-2 rounded" onClick={handleLogin}>
            Entra
          </button>
        </div>
      </div>
    );

  // --- showroom ---
  if (user.role === "showroom")
    return (
      <div className="p-4">
        <header className="flex justify-between items-center mb-4">
          <img src="/public/mars3lo.png" alt="Logo" className="w-28" />
          <h1 className="text-xl font-bold">Showroom Centergross</h1>
        </header>
        <div className="flex gap-2 mb-4">
          <input className="border p-2" placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <input
            className="border p-2 w-20"
            type="number"
            value={sconto}
            onChange={(e) => setSconto(parseInt(e.target.value) || 0)}
            placeholder="Sconto %"
          />
          <input className="border p-2 flex-1" placeholder="Cerca..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="border p-2" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
            <option value="">Tutte</option>
            {Object.entries(CATEGORIE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="border px-2" onClick={() => setViewMode(viewMode === "griglia" ? "lista" : "griglia")}>
            {viewMode === "griglia" ? "Lista" : "Griglia"}
          </button>
        </div>

        {viewMode === "lista" ? (
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th>Articolo</th>
                <th>Categoria</th>
                <th>Colore</th>
                <th>Taglia</th>
                <th>Qta disp</th>
                <th>Prezzo</th>
                <th>Azione</th>
              </tr>
            </thead>
            <tbody>
              {stockFiltrato.map((r) => (
                <tr key={r.sku} className="border-t">
                  <td>{r.articolo}</td>
                  <td>{CATEGORIE_LABELS[r.categoria] || r.categoria}</td>
                  <td>{r.colore}</td>
                  <td>{r.taglia}</td>
                  <td>{r.qty}</td>
                  <td>€ {r.prezzo.toFixed(2)}</td>
                  <td>
                    <button className="bg-black text-white px-2 py-1 rounded" onClick={() => addToCart({ ...r, richiesti: 1 })}>
                      Aggiungi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div>
            {Object.values(
              stockFiltrato.reduce((acc: any, r) => {
                const key = r.articolo + "-" + r.colore;
                if (!acc[key]) acc[key] = [];
                acc[key].push(r);
                return acc;
              }, {})
            ).map((righe: StockRow[], idx) => (
              <table key={idx} className="w-full border mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th colSpan={righe.length}>
                      {righe[0].articolo} {CATEGORIE_LABELS[righe[0].categoria] || righe[0].categoria} —{" "}
                      <span className="font-bold">{righe[0].colore}</span> (Prezzo: € {righe[0].prezzo.toFixed(2)})
                    </th>
                  </tr>
                  <tr>
                    {righe.map((r) => (
                      <th key={r.sku}>{r.taglia}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {righe.map((r) => (
                      <td key={r.sku} className="text-center">
                        {r.qty}
                        <br />
                        <input id={`qty-${r.sku}`} type="number" min={0} max={r.qty} className="border w-12" />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td colSpan={righe.length} className="text-right">
                      <button
                        className="bg-black text-white px-3 py-1 rounded"
                        onClick={() => {
                          righe.forEach((r) => {
                            const val = parseInt((document.getElementById(`qty-${r.sku}`) as HTMLInputElement)?.value || "0");
                            if (val > 0) addToCart({ ...r, richiesti: val });
                          });
                        }}
                      >
                        Aggiungi tutte
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            ))}
          </div>
        )}

        {/* Carrello */}
        <h2 className="text-lg font-bold mt-6">Carrello</h2>
        <table className="w-full border mb-2">
          <thead>
            <tr className="bg-gray-100">
              <th>Articolo</th>
              <th>Colore</th>
              <th>Taglia</th>
              <th>Qta</th>
              <th>Prezzo</th>
              <th>Totale</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {carrello.map((r, i) => (
              <tr key={i} className="border-t">
                <td>{r.articolo}</td>
                <td>{r.colore}</td>
                <td>{r.taglia}</td>
                <td>{r.richiesti}</td>
                <td>€ {r.prezzo.toFixed(2)}</td>
                <td>€ {(r.richiesti * r.prezzo).toFixed(2)}</td>
                <td>
                  <button onClick={() => removeFromCart(r.sku)} className="text-red-500">
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2 mb-4">
          <button className="bg-red-500 text-white px-3 py-1 rounded" onClick={clearCart}>
            Svuota tutto
          </button>
          <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={inviaOrdine}>
            Invia ordine
          </button>
          <button className="bg-blue-500 text-white px-3 py-1 rounded" onClick={exportPDF}>
            PDF
          </button>
          <button className="bg-yellow-500 text-black px-3 py-1 rounded" onClick={exportExcel}>
            Excel
          </button>
        </div>
      </div>
    );

  // --- magazzino ---
  if (user.role === "magazzino")
    return (
      <div className="p-4">
        <header className="flex justify-between items-center mb-4">
          <img src="/public/mars3lo.png" alt="Logo" className="w-28" />
          <h1 className="text-xl font-bold">Magazzino Napoli</h1>
        </header>
        <h2 className="text-lg font-bold">Ordini ricevuti</h2>
        {ordini.map((o) => (
          <div key={o.id} className="border p-2 mb-4">
            <h3 className="font-bold">
              Cliente: {o.customer} — Stato: {o.stato}
            </h3>
            <table className="w-full border mb-2">
              <thead>
                <tr className="bg-gray-100">
                  <th>Articolo</th>
                  <th>Colore</th>
                  <th>Taglia</th>
                  <th>Richiesti</th>
                  <th>Confermati</th>
                </tr>
              </thead>
              <tbody>
                {o.order_lines.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td>{r.articolo}</td>
                    <td>{r.colore}</td>
                    <td>{r.taglia}</td>
                    <td>{r.richiesti}</td>
                    <td>
                      <input id={`conf-${r.id}`} type="number" min={0} max={r.richiesti} defaultValue={r.richiesti} className="border w-16" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={() => confermaOrdine(o.id, o.order_lines)}>
              Conferma ordine
            </button>
          </div>
        ))}
      </div>
    );

  return null;
}
