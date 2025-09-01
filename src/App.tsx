import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { saveAs } from "file-saver";

// 🔹 Configurazione Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// 🔹 Classificazione articoli
function getCategoria(sku: string): string {
  const c = sku.toUpperCase();
  if (c.startsWith("G")) return "GIACCHE";
  if (c.startsWith("P")) return "PANTALONI";
  if (c.startsWith("GB")) return "GIUBBOTTI";
  if (c.startsWith("MG")) return "MAGLIE";
  if (c.startsWith("CAP")) return "CAPPOTTI";
  return "ALTRO";
}

// 🔹 Tipi
interface Stock {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
}

interface RigaOrdine extends Stock {
  qta: number;
}

// 🔹 Login credenziali fisse
const USERS = [
  { id: "Mars3loBo", pw: "Francesco01", ruolo: "showroom" },
  { id: "Mars3loNa", pw: "Gbesse01", ruolo: "magazzino" },
];

export default function App() {
  const [user, setUser] = useState<{ ruolo: string; id: string } | null>(null);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [stock, setStock] = useState<Stock[]>([]);
  const [carrello, setCarrello] = useState<RigaOrdine[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);
  const [filtroCategoria, setFiltroCategoria] = useState("Tutti");

  // 🔹 Caricamento stock da Supabase
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("stock").select("*");
      if (data) setStock(data as Stock[]);
    })();
  }, [user]);

  // 🔹 Login
  function handleLogin() {
    const u = USERS.find((x) => x.id === id && x.pw === pw);
    if (!u) {
      alert("Credenziali errate");
      return;
    }
    setUser({ ruolo: u.ruolo, id: u.id });
  }

  // 🔹 Aggiungi ordine per articolo+colore
  function aggiungiRiga(righe: RigaOrdine[]) {
    setCarrello((prev) => {
      const nuovo = [...prev];
      righe.forEach((r) => {
        const idx = nuovo.findIndex(
          (x) => x.sku === r.sku && x.taglia === r.taglia
        );
        if (idx >= 0) nuovo[idx].qta = r.qta;
        else nuovo.push(r);
      });
      return nuovo;
    });
  }

  // 🔹 Svuota riga
  function svuotaArticolo(sku: string, colore: string) {
    setCarrello((prev) =>
      prev.filter((r) => !(r.sku === sku && r.colore === colore))
    );
  }

  // 🔹 Totali
  const totale = carrello.reduce((s, r) => s + r.qta * r.prezzo, 0);
  const totaleScontato = totale * (1 - sconto / 100);

  // 🔹 Esporta Excel
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(carrello);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, `ordine_${cliente}.xlsx`);
  }

  // 🔹 Esporta CSV
  function exportCSV() {
    const righe = carrello.map(
      (r) =>
        `${r.sku};${r.articolo};${r.colore};${r.taglia};${r.qta};${r.prezzo.toFixed(
          2
        )}`
    );
    const blob = new Blob([righe.join("\n")], { type: "text/csv" });
    saveAs(blob, `ordine_${cliente}.csv`);
  }

  // 🔹 Esporta PDF
  function exportPDF() {
    const doc = new jsPDF();
    doc.text(`Ordine cliente: ${cliente}`, 10, 10);
    (doc as any).autoTable({
      head: [["Articolo", "Taglia", "Colore", "Q.tà", "Prezzo", "Totale"]],
      body: carrello.map((r) => [
        r.articolo,
        r.taglia,
        r.colore,
        r.qta,
        `€${r.prezzo.toFixed(2)}`,
        `€${(r.qta * r.prezzo).toFixed(2)}`,
      ]),
    });
    doc.text(
      `Totale: €${totale.toFixed(2)}  Totale scontato: €${totaleScontato.toFixed(
        2
      )}`,
      10,
      (doc as any).lastAutoTable.finalY + 10
    );
    doc.save(`ordine_${cliente}.pdf`);
  }

  // 🔹 Login screen
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <img src="/public/public/mars3lo.png" className="h-24 mb-4" />
        <h1 className="text-2xl font-bold mb-6">Mars3lo B2B – Login</h1>
        <input
          placeholder="ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="mb-2 p-2 text-black"
        />
        <input
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="mb-4 p-2 text-black"
        />
        <button
          onClick={handleLogin}
          className="bg-white text-black px-4 py-2 rounded"
        >
          Entra
        </button>
      </div>
    );
  }

  // 🔹 Filtra stock
  const stockFiltrato =
    filtroCategoria === "Tutti"
      ? stock
      : stock.filter((s) => getCategoria(s.sku) === filtroCategoria);

  return (
    <div className="p-4">
      {/* Barra superiore */}
      <div className="bg-black text-white flex items-center justify-center h-16 mb-4">
        <img src="/public/public/mars3lo.png" className="h-12 mr-4" />
        <span className="text-xl font-bold">MARS3LO B2B</span>
      </div>

      {/* Filtro */}
      <div className="mb-4">
        <label className="mr-2">Categoria:</label>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="p-2 border"
        >
          <option>Tutti</option>
          <option>GIACCHE</option>
          <option>PANTALONI</option>
          <option>GIUBBOTTI</option>
          <option>MAGLIE</option>
          <option>CAPPOTTI</option>
        </select>
      </div>

      {/* Cliente + Sconto */}
      <div className="mb-4 flex items-center gap-4">
        <input
          placeholder="Cliente"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          className="p-2 border"
        />
        <div className="flex items-center">
          <span className="mr-2">Sconto %</span>
          <input
            type="number"
            value={sconto}
            onChange={(e) => setSconto(Number(e.target.value))}
            className="w-20 p-2 border"
          />
        </div>
      </div>

      {/* Griglia */}
      {stockFiltrato.map((art) => (
        <div
          key={art.sku + art.colore}
          className="border p-2 mb-4 rounded shadow"
        >
          <div className="font-bold mb-2">
            {art.sku} {art.articolo} – {art.colore} – €
            {Number(art.prezzo).toFixed(2)}
          </div>
          <div className="grid grid-cols-6 gap-2">
            <div>Taglia</div>
            <div>Disponibili</div>
            <div>Ordina</div>
          </div>
          <div className="grid grid-cols-6 gap-2 items-center">
            <div>{art.taglia}</div>
            <div>{art.qty}</div>
            <input
              type="number"
              min={0}
              max={art.qty}
              onChange={(e) =>
                aggiungiRiga([
                  { ...art, qta: Number(e.target.value) },
                ])
              }
              className="border p-1 w-16"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() =>
                svuotaArticolo(art.sku, art.colore)
              }
              className="bg-red-500 text-white px-2 py-1 rounded"
            >
              Svuota
            </button>
          </div>
        </div>
      ))}

      {/* Carrello */}
      <h2 className="text-xl font-bold mb-2">Ordine</h2>
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
          {carrello.map((r, i) => (
            <tr key={i}>
              <td>{r.articolo}</td>
              <td>{r.taglia}</td>
              <td>{r.colore}</td>
              <td>{r.qta}</td>
              <td>€{r.prezzo.toFixed(2)}</td>
              <td>€{(r.qta * r.prezzo).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-4">
        <div>Totale: €{totale.toFixed(2)}</div>
        <div>Totale scontato: €{totaleScontato.toFixed(2)}</div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={exportExcel}
          className="bg-green-500 text-white px-2 py-1 rounded"
        >
          Esporta Excel
        </button>
        <button
          onClick={exportCSV}
          className="bg-blue-500 text-white px-2 py-1 rounded"
        >
          Esporta CSV
        </button>
        <button
          onClick={exportPDF}
          className="bg-red-500 text-white px-2 py-1 rounded"
        >
          Esporta PDF
        </button>
      </div>
    </div>
  );
}
