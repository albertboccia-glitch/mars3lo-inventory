import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// 🔑 Inserisci i dati del tuo Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// ───────────────────────────────
// Tipi
// ───────────────────────────────
type Stock = {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
};

type OrderLine = {
  sku: string;
  articolo: string;
  taglia: string;
  colore: string;
  richiesti: number;
  prezzo: number;
};

type Order = {
  id: string;
  created_at: string;
  customer: string;
  stato: string;
  lines: OrderLine[];
};

// ───────────────────────────────
// Funzione classificazione articoli
// ───────────────────────────────
function getCategoria(codice: string): string {
  const code = codice.toUpperCase();
  if (code.startsWith("GB")) return "GIUBBOTTI";
  if (code.startsWith("MG")) return "MAGLIE";
  if (code.startsWith("PM")) return "PANTALONI FELPA";
  if (code.startsWith("G")) return "GIACCHE";
  if (code.startsWith("P")) return "PANTALONI";
  if (code.startsWith("C")) return "CAMICIE";
  return "ALTRO";
}

// ───────────────────────────────
// App principale
// ───────────────────────────────
export default function App() {
  const [role, setRole] = useState<"login" | "showroom" | "magazzino">(
    "login"
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [stock, setStock] = useState<Stock[]>([]);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("TUTTI");

  const [cart, setCart] = useState<OrderLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [sconto, setSconto] = useState(0);

  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrders, setNewOrders] = useState(0); // badge rosso

  // ───────────────────────────────
  // Login
  // ───────────────────────────────
  const handleLogin = () => {
    if (username === "Mars3loBo" && password === "Francesco01") {
      setRole("showroom");
    } else if (username === "Mars3loNa" && password === "Gbesse01") {
      setRole("magazzino");
    } else {
      alert("Credenziali non valide");
    }
  };

  // ───────────────────────────────
  // Caricamento stock
  // ───────────────────────────────
  useEffect(() => {
    if (role !== "login") {
      supabase.from("stock").select("*").then(({ data }) => {
        if (data) setStock(data as Stock[]);
      });
    }
  }, [role]);

  // ───────────────────────────────
  // Caricamento ordini (solo Magazzino)
  // ───────────────────────────────
  useEffect(() => {
    if (role === "magazzino") {
      loadOrders();
      const channel = supabase
        .channel("orders-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          () => {
            setNewOrders((prev) => prev + 1);
            loadOrders();
          }
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [role]);

  const loadOrders = async () => {
    const { data: ordini } = await supabase
      .from("orders")
      .select("id, created_at, customer, stato, order_lines(*)")
      .order("created_at", { ascending: false });
    if (ordini) {
      setOrders(
        ordini.map((o: any) => ({
          id: o.id,
          created_at: o.created_at,
          customer: o.customer,
          stato: o.stato,
          lines: o.order_lines,
        }))
      );
    }
  };

  // ───────────────────────────────
  // Showroom: aggiungi / svuota
  // ───────────────────────────────
  const addToCart = (line: OrderLine) => {
    setCart((prev) => {
      const exist = prev.find((l) => l.sku === line.sku);
      if (exist) {
        return prev.map((l) =>
          l.sku === line.sku ? { ...l, richiesti: line.richiesti } : l
        );
      }
      return [...prev, line];
    });
  };

  const emptyCart = () => setCart([]);

  // ───────────────────────────────
  // Totali
  // ───────────────────────────────
  const totale = cart.reduce((sum, l) => sum + l.richiesti * l.prezzo, 0);
  const totaleScontato = totale - totale * (sconto / 100);

  // ───────────────────────────────
  // Export PDF
  // ───────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Ordine cliente: ${customer}`, 10, 10);
    autoTable(doc, {
      head: [["Articolo", "Taglia", "Colore", "Q.tà", "Prezzo", "Totale"]],
      body: cart.map((l) => [
        l.articolo,
        l.taglia,
        l.colore,
        l.richiesti,
        `€${l.prezzo}`,
        `€${l.richiesti * l.prezzo}`,
      ]),
    });
    doc.text(`Totale: €${totaleScontato}`, 10, doc.lastAutoTable.finalY + 10);
    doc.save("ordine.pdf");
  };

  // ───────────────────────────────
  // Export Excel
  // ───────────────────────────────
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(cart);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, "ordine.xlsx");
  };

  // ───────────────────────────────
  // Showroom: invia ordine
  // ───────────────────────────────
  const sendOrder = async () => {
    if (!customer || cart.length === 0) return alert("Completa i campi");
    const orderId = Date.now().toString();
    const { error } = await supabase.from("orders").insert({
      id: orderId,
      customer,
      stato: "In attesa",
    });
    if (error) return alert("Errore invio ordine");

    for (const l of cart) {
      await supabase.from("order_lines").insert({
        order_id: orderId,
        sku: l.sku,
        articolo: l.articolo,
        taglia: l.taglia,
        colore: l.colore,
        richiesti: l.richiesti,
        prezzo: l.prezzo,
      });
    }
    alert("Ordine inviato!");
    setCart([]);
  };

  // ───────────────────────────────
  // Magazzino: conferma / annulla
  // ───────────────────────────────
  const confermaOrdine = async (orderId: string) => {
    await supabase
      .from("orders")
      .update({ stato: "Confermato" })
      .eq("id", orderId);
    loadOrders();
  };

  const annullaOrdine = async (orderId: string) => {
    await supabase
      .from("orders")
      .update({ stato: "Annullato" })
      .eq("id", orderId);
    loadOrders();
  };

  // ───────────────────────────────
  // Render
  // ───────────────────────────────
  if (role === "login") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
        <img src="/mars3lo.png" alt="Mars3lo" className="h-24 mb-4" />
        <h1 className="text-2xl font-bold mb-6">MARS3LO B2B</h1>
        <div className="bg-white text-black p-6 rounded shadow w-80">
          <input
            placeholder="ID"
            className="border p-2 w-full mb-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="border p-2 w-full mb-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            onClick={handleLogin}
            className="bg-black text-white px-4 py-2 rounded w-full"
          >
            Entra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra logo */}
      <div className="bg-black py-3 text-center">
        <img src="/mars3lo.png" alt="Mars3lo" className="h-10 mx-auto" />
        <p className="text-white font-bold">MARS3LO B2B</p>
      </div>

      {role === "showroom" && (
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Showroom Centergross</h2>

          <div className="flex gap-2 mb-4">
            <input
              placeholder="Cliente"
              className="border p-2"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
            <input
              type="number"
              placeholder="Sconto %"
              className="border p-2 w-24"
              value={sconto}
              onChange={(e) => setSconto(parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="flex gap-2 mb-4">
            <input
              placeholder="Cerca..."
              className="border p-2 flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="border p-2"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option>TUTTI</option>
              <option>GIACCHE</option>
              <option>GIUBBOTTI</option>
              <option>MAGLIE</option>
              <option>PANTALONI</option>
              <option>PANTALONI FELPA</option>
              <option>CAMICIE</option>
            </select>
          </div>

          {/* Tabella griglia */}
          <table className="w-full border mb-6">
            <thead className="bg-gray-200">
              <tr>
                <th>Articolo</th>
                <th>Taglia</th>
                <th>Colore</th>
                <th>Disponibili</th>
                <th>Prezzo</th>
                <th>Ordina</th>
              </tr>
            </thead>
            <tbody>
              {stock
                .filter(
                  (s) =>
                    (categoria === "TUTTI" || s.categoria === categoria) &&
                    (s.articolo.toLowerCase().includes(search.toLowerCase()) ||
                      s.colore.toLowerCase().includes(search.toLowerCase()))
                )
                .map((s) => (
                  <tr key={s.sku} className="border-t">
                    <td>{s.articolo}</td>
                    <td>{s.taglia}</td>
                    <td className="font-bold">{s.colore}</td>
                    <td>{s.qty}</td>
                    <td>€{s.prezzo}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={s.qty}
                        className="border w-16 p-1"
                        onChange={(e) =>
                          addToCart({
                            sku: s.sku,
                            articolo: s.articolo,
                            taglia: s.taglia,
                            colore: s.colore,
                            richiesti: parseInt(e.target.value) || 0,
                            prezzo: s.prezzo,
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* Carrello */}
          <h3 className="text-lg font-bold mb-2">Ordine</h3>
          <table className="w-full border mb-2">
            <thead className="bg-gray-200">
              <tr>
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
                <tr key={l.sku} className="border-t">
                  <td>{l.articolo}</td>
                  <td>{l.taglia}</td>
                  <td>{l.colore}</td>
                  <td>{l.richiesti}</td>
                  <td>€{l.prezzo}</td>
                  <td>€{l.richiesti * l.prezzo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Totale: €{totale}</p>
          <p>Totale scontato: €{totaleScontato}</p>

          <div className="flex gap-2 mt-2">
            <button
              onClick={sendOrder}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Invia Ordine
            </button>
            <button
              onClick={exportPDF}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              PDF
            </button>
            <button
              onClick={exportExcel}
              className="bg-yellow-600 text-white px-4 py-2 rounded"
            >
              Excel
            </button>
            <button
              onClick={emptyCart}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Svuota Ordine
            </button>
          </div>
        </div>
      )}

      {role === "magazzino" && (
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">
            MAGAZZINO Napoli – Ordini{" "}
            {newOrders > 0 && (
              <span className="bg-red-600 text-white px-2 py-1 rounded-full text-sm">
                {newOrders}
              </span>
            )}
          </h2>

          {orders.map((o) => (
            <div key={o.id} className="border p-2 mb-2">
              <p>
                <b>{o.customer}</b> – {new Date(o.created_at).toLocaleString()} –{" "}
                {o.stato}
              </p>
              <table className="w-full border mb-2">
                <thead className="bg-gray-200">
                  <tr>
                    <th>Articolo</th>
                    <th>Taglia</th>
                    <th>Colore</th>
                    <th>Richiesti</th>
                    <th>Prezzo</th>
                  </tr>
                </thead>
                <tbody>
                  {o.lines.map((l) => (
                    <tr key={l.sku} className="border-t">
                      <td>{l.articolo}</td>
                      <td>{l.taglia}</td>
                      <td>{l.colore}</td>
                      <td>{l.richiesti}</td>
                      <td>€{l.prezzo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex gap-2">
                <button
                  onClick={() => confermaOrdine(o.id)}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  Conferma
                </button>
                <button
                  onClick={() => annullaOrdine(o.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Annulla
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
