import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// ----------- UTILS ------------
function getCategoria(code: string): string {
  const c = code.toUpperCase();
  if (c.startsWith("GB")) return "GIUBBOTTI";
  if (c.startsWith("MG")) return "MAGLIE";
  if (c.startsWith("PM")) return "PANTALONI FELPA";
  if (c.startsWith("P")) return "PANTALONI";
  if (c.startsWith("G")) return "GIACCHE";
  if (c.startsWith("C")) return "CAMICIE";
  return "ALTRO";
}

function groupStock(rows: any[]) {
  const grouped: any[] = [];
  rows.forEach((r) => {
    const key = r.articolo + "|" + r.colore;
    let g = grouped.find((x) => x.key === key);
    if (!g) {
      g = {
        key,
        articolo: r.articolo,
        colore: r.colore,
        prezzo: r.prezzo,
        sizes: {},
      };
      grouped.push(g);
    }
    g.sizes[r.taglia] = r.qty;
  });
  return grouped;
}

// ----------- COMPONENTE PRINCIPALE ------------
export default function App() {
  const [user, setUser] = useState<null | { ruolo: string }> (null);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [stock, setStock] = useState<any[]>([]);
  const [categoria, setCategoria] = useState("TUTTI");
  const [search, setSearch] = useState("");
  const [carrello, setCarrello] = useState<any[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);
  const [ordini, setOrdini] = useState<any[]>([]);

  // login semplice
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (id === "Mars3loBo" && pw === "Francesco01") {
      setUser({ ruolo: "showroom" });
    } else if (id === "Mars3loNa" && pw === "Gbesse01") {
      setUser({ ruolo: "magazzino" });
    } else {
      alert("Credenziali errate");
    }
  }

  // carica stock
  useEffect(() => {
    if (!user) return;
    async function loadStock() {
      const { data } = await supabase.from("stock").select("*");
      if (data) setStock(data);
    }
    loadStock();
  }, [user]);

  // carica ordini per magazzino
  useEffect(() => {
    if (user?.ruolo !== "magazzino") return;
    async function loadOrders() {
      const { data } = await supabase.from("orders").select("*");
      if (data) setOrdini(data);
    }
    loadOrders();
  }, [user]);

  // aggiungi articoli al carrello
  function aggiungiRiga(g: any, inputs: Record<string, number>) {
    const newItems: any[] = [];
    Object.entries(inputs).forEach(([taglia, qty]) => {
      if (qty && qty > 0) {
        newItems.push({
          articolo: g.articolo,
          colore: g.colore,
          taglia,
          prezzo: g.prezzo,
          qty,
        });
      }
    });
    // sostituisco righe con stesso articolo/colore/taglia
    const updated = carrello.filter(
      (c) => !newItems.some(
        (n) =>
          n.articolo === c.articolo &&
          n.colore === c.colore &&
          n.taglia === c.taglia
      )
    );
    setCarrello([...updated, ...newItems]);
  }

  function svuotaRiga(g: any) {
    setCarrello(
      carrello.filter(
        (c) => !(c.articolo === g.articolo && c.colore === g.colore)
      )
    );
  }

  function totaleLordo() {
    return carrello.reduce((s, c) => s + c.prezzo * c.qty, 0);
  }
  function totaleNetto() {
    return totaleLordo() * (1 - sconto / 100);
  }

  // esporta ordine PDF
  function esportaPDF() {
    const doc = new jsPDF();
    doc.text(`Ordine cliente: ${cliente}`, 10, 10);
    autoTable(doc, {
      head: [["Articolo", "Colore", "Taglia", "Q.tà", "Prezzo", "Totale"]],
      body: carrello.map((c) => [
        c.articolo,
        c.colore,
        c.taglia,
        c.qty,
        "€" + c.prezzo,
        "€" + c.prezzo * c.qty,
      ]),
    });
    doc.text(`Totale: €${totaleNetto()}`, 10, doc.lastAutoTable.finalY + 10);
    doc.save("ordine.pdf");
  }

  // showroom griglia
  function Showroom() {
    const grouped = groupStock(stock);
    const filtered = grouped.filter(
      (g) =>
        (categoria === "TUTTI" || getCategoria(g.articolo) === categoria) &&
        (g.articolo.toLowerCase().includes(search.toLowerCase()) ||
          g.colore.toLowerCase().includes(search.toLowerCase()))
    );

    return (
      <div className="p-4">
        <div className="mb-2 flex items-center space-x-2">
          <input
            placeholder="Cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className="border p-1"
          />
          <input
            type="number"
            placeholder="Sconto %"
            value={sconto}
            onChange={(e) => setSconto(Number(e.target.value))}
            className="border p-1 w-20"
          />
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="border p-1"
          >
            <option>TUTTI</option>
            <option>GIACCHE</option>
            <option>GIUBBOTTI</option>
            <option>MAGLIE</option>
            <option>PANTALONI</option>
            <option>PANTALONI FELPA</option>
            <option>CAMICIE</option>
          </select>
          <input
            placeholder="Cerca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border p-1"
          />
        </div>

        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th>Articolo</th>
              <th>Colore</th>
              <th>Prezzo</th>
              {Array.from(
                new Set(stock.map((s) => s.taglia))
              ).map((t) => (
                <th key={t}>{t}</th>
              ))}
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => {
              const [inputs, setInputs] = useState<Record<string, number>>({});
              return (
                <tr key={g.key} className="border-t">
                  <td>{g.articolo}</td>
                  <td className="font-bold">{g.colore}</td>
                  <td>€{g.prezzo}</td>
                  {Array.from(new Set(stock.map((s) => s.taglia))).map(
                    (t) => (
                      <td key={t}>
                        <input
                          type="number"
                          min={0}
                          max={g.sizes[t] || 0}
                          value={inputs[t] || ""}
                          onChange={(e) =>
                            setInputs({
                              ...inputs,
                              [t]: Number(e.target.value),
                            })
                          }
                          className="w-12 border p-1"
                        />
                        <div className="text-xs text-gray-500">
                          {g.sizes[t] || 0}
                        </div>
                      </td>
                    )
                  )}
                  <td>
                    <button
                      onClick={() => aggiungiRiga(g, inputs)}
                      className="bg-green-500 text-white px-2 py-1 mr-1"
                    >
                      Aggiungi
                    </button>
                    <button
                      onClick={() => svuotaRiga(g)}
                      className="bg-red-500 text-white px-2 py-1"
                    >
                      Svuota
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4">
          <h3 className="font-bold">Ordine</h3>
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th>Articolo</th>
                <th>Colore</th>
                <th>Taglia</th>
                <th>Q.tà</th>
                <th>Prezzo</th>
                <th>Totale</th>
              </tr>
            </thead>
            <tbody>
              {carrello.map((c, i) => (
                <tr key={i}>
                  <td>{c.articolo}</td>
                  <td>{c.colore}</td>
                  <td>{c.taglia}</td>
                  <td>{c.qty}</td>
                  <td>€{c.prezzo}</td>
                  <td>€{c.prezzo * c.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2">
            Totale: €{totaleLordo()} <br />
            Totale scontato: €{totaleNetto()}
          </div>
          <button
            onClick={esportaPDF}
            className="bg-blue-500 text-white px-2 py-1 mt-2"
          >
            Esporta PDF
          </button>
        </div>
      </div>
    );
  }

  // magazzino: lista ordini
  function Magazzino() {
    return (
      <div className="p-4">
        <h2 className="font-bold text-lg mb-2">Ordini ricevuti</h2>
        {ordini.map((o) => (
          <div key={o.id} className="border p-2 mb-2">
            Ordine {o.id} - Cliente: {o.customer}
          </div>
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
        <img src="/mars3lo.png" className="w-40 mb-4" />
        <form onSubmit={handleLogin} className="bg-gray-900 p-4 rounded">
          <input
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="block mb-2 p-1 text-black"
          />
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="block mb-2 p-1 text-black"
          />
          <button className="bg-blue-500 px-4 py-2">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-black text-white flex items-center justify-center h-16">
        <img src="/mars3lo.png" className="h-12 mr-2" />
        <span className="font-bold text-lg">MARS3LO B2B</span>
      </div>
      {user.ruolo === "showroom" && <Showroom />}
      {user.ruolo === "magazzino" && <Magazzino />}
    </div>
  );
}
