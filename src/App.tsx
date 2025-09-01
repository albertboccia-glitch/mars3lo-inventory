import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// 🔹 funzione classificazione articoli
function getCategoria(code: string): string {
  const c = code.toUpperCase();
  if (c.startsWith("GB")) return "GIUBBOTTI";
  if (c.startsWith("MG")) return "MAGLIE";
  if (c.startsWith("PM")) return "PANTALONI FELPA";
  if (c.startsWith("CAP")) return "CAPPOTTI";
  if (c.startsWith("P")) return "PANTALONI";
  if (c.startsWith("G")) return "GIACCHE";
  if (c.startsWith("C")) return "CAMICIE";
  return "ALTRO";
}

// 🔹 ordinamento taglie numeriche e lettere
function sortTaglie(taglie: string[]): string[] {
  const ordineLettere = ["XS", "S", "M", "L", "XL", "XXL"];
  return taglie.sort((a, b) => {
    const na = parseInt(a);
    const nb = parseInt(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return ordineLettere.indexOf(a) - ordineLettere.indexOf(b);
  });
}

type StockRow = {
  sku: string;
  articolo: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
};

type CarrelloRow = StockRow & { ord: number };

export default function App() {
  const [utente, setUtente] = useState<"login" | "showroom" | "magazzino">("login");
  const [id, setId] = useState("");
  const [pwd, setPwd] = useState("");
  const [stock, setStock] = useState<StockRow[]>([]);
  const [carrello, setCarrello] = useState<CarrelloRow[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);
  const [categoriaFiltro, setCategoriaFiltro] = useState("TUTTI");

  // 🔹 login
  function handleLogin() {
    if (id === "Mars3loBo" && pwd === "Francesco01") setUtente("showroom");
    else if (id === "Mars3loNa" && pwd === "Gbesse01") setUtente("magazzino");
    else alert("Credenziali errate");
  }

  // 🔹 fetch stock da Supabase
  useEffect(() => {
    if (utente !== "login") {
      supabase.from("stock").select("*").then(({ data }) => {
        if (data) setStock(data as StockRow[]);
      });
    }
  }, [utente]);

  // 🔹 raggruppa stock per articolo/colore
  const gruppi = Object.values(
    stock.reduce((acc: any, r) => {
      const key = r.articolo + "-" + r.colore;
      if (!acc[key]) {
        acc[key] = {
          articolo: r.articolo,
          colore: r.colore,
          prezzo: r.prezzo,
          taglie: {},
        };
      }
      acc[key].taglie[r.taglia] = r;
      return acc;
    }, {})
  );

  // 🔹 aggiungi al carrello
  function aggiungi(gruppo: any, quanti: Record<string, number>) {
    const nuove: CarrelloRow[] = [];
    for (const t in quanti) {
      const q = quanti[t];
      if (q > 0) {
        nuove.push({ ...gruppo.taglie[t], ord: q });
      }
    }
    setCarrello([...carrello.filter(c => !(c.articolo === gruppo.articolo && c.colore === gruppo.colore)), ...nuove]);
  }

  // 🔹 svuota riga
  function svuota(gruppo: any) {
    setCarrello(carrello.filter(c => !(c.articolo === gruppo.articolo && c.colore === gruppo.colore)));
  }

  // 🔹 totali
  const totale = carrello.reduce((s, r) => s + r.ord * r.prezzo, 0);
  const totaleScontato = totale * (1 - sconto / 100);

  // 🔹 esporta CSV
  function exportCSV() {
    const header = ["Articolo", "Taglia", "Colore", "Q.tà", "Prezzo", "Totale"];
    const rows = carrello.map(r => [
      r.articolo,
      r.taglia,
      r.colore,
      r.ord,
      r.prezzo.toFixed(2),
      (r.ord * r.prezzo).toFixed(2),
    ]);
    const csv = [header, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ordine.csv";
    a.click();
  }

  // 🔹 esporta Excel
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(
      carrello.map(r => ({
        Articolo: r.articolo,
        Taglia: r.taglia,
        Colore: r.colore,
        Quantità: r.ord,
        Prezzo: r.prezzo.toFixed(2),
        Totale: (r.ord * r.prezzo).toFixed(2),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, "ordine.xlsx");
  }

  // 🔹 esporta PDF
  function exportPDF() {
    const doc = new jsPDF();
    doc.text("Ordine Cliente: " + cliente, 10, 10);
    autoTable(doc, {
      head: [["Articolo", "Taglia", "Colore", "Q.tà", "Prezzo", "Totale"]],
      body: carrello.map(r => [
        r.articolo,
        r.taglia,
        r.colore,
        r.ord,
        r.prezzo.toFixed(2),
        (r.ord * r.prezzo).toFixed(2),
      ]),
    });
    doc.text(`Totale: €${totale.toFixed(2)}`, 10, doc.lastAutoTable.finalY + 10);
    doc.text(`Totale scontato: €${totaleScontato.toFixed(2)}`, 10, doc.lastAutoTable.finalY + 20);
    doc.save("ordine.pdf");
  }

  if (utente === "login") {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        <div className="p-8 bg-gray-900 rounded-xl w-96 text-center">
          <img src="/public/mars3lo.png" alt="logo" className="mx-auto mb-4 h-16" />
          <h1 className="text-xl font-bold mb-4">Mars3lo B2B – Login</h1>
          <input className="w-full mb-2 p-2 text-black" placeholder="ID" value={id} onChange={e => setId(e.target.value)} />
          <input className="w-full mb-2 p-2 text-black" type="password" placeholder="Password" value={pwd} onChange={e => setPwd(e.target.value)} />
          <button onClick={handleLogin} className="bg-blue-600 hover:bg-blue-800 w-full py-2 rounded">
            Entra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Barra superiore */}
      <div className="bg-black text-white py-2 flex items-center justify-center mb-4">
        <img src="/public/mars3lo.png" alt="logo" className="h-10 mr-2" />
        <span className="text-lg font-bold">MARS3LO B2B</span>
      </div>

      {/* Cliente + Sconto */}
      <div className="flex gap-2 mb-4">
        <input
          className="border p-2 flex-1"
          placeholder="Cliente"
          value={cliente}
          onChange={e => setCliente(e.target.value)}
        />
        <input
          className="border p-2 w-20"
          type="number"
          placeholder="Sconto %"
          value={sconto}
          onChange={e => setSconto(Number(e.target.value))}
        />
      </div>

      {/* Filtro categorie */}
      <div className="mb-4">
        <select className="border p-2" value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}>
          <option value="TUTTI">TUTTI</option>
          <option value="GIACCHE">GIACCHE</option>
          <option value="PANTALONI">PANTALONI</option>
          <option value="GIUBBOTTI">GIUBBOTTI</option>
          <option value="MAGLIE">MAGLIE</option>
          <option value="PANTALONI FELPA">PANTALONI FELPA</option>
          <option value="CAMICIE">CAMICIE</option>
          <option value="CAPPOTTI">CAPPOTTI</option>
          <option value="ALTRO">ALTRO</option>
        </select>
      </div>

      {/* Griglia */}
      {gruppi
        .filter(g => categoriaFiltro === "TUTTI" || getCategoria(g.articolo) === categoriaFiltro)
        .map((g, idx) => {
          const taglie = sortTaglie(Object.keys(g.taglie));
          const [q, setQ] = useState<Record<string, number>>({});

          return (
            <div key={idx} className="border rounded-lg mb-4 p-2">
              <div className="font-bold mb-2">
                {g.articolo} – {getCategoria(g.articolo)} – {g.colore} – €{Number(g.prezzo).toFixed(2)}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead>
                    <tr>
                      {taglie.map(t => (
                        <th key={t} className="px-2 py-1 border">{t}</th>
                      ))}
                    </tr>
                    <tr>
                      {taglie.map(t => (
                        <td key={t} className="px-2 py-1 border text-center">{g.taglie[t]?.qty ?? 0}</td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {taglie.map(t => (
                        <td key={t} className="px-2 py-1 border">
                          <input
                            type="number"
                            min="0"
                            className="w-16 border"
                            value={q[t] || ""}
                            onChange={e => setQ({ ...q, [t]: Number(e.target.value) })}
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => aggiungi(g, q)} className="bg-green-600 text-white px-4 py-1 rounded">Aggiungi</button>
                <button onClick={() => svuota(g)} className="bg-red-600 text-white px-4 py-1 rounded">Svuota</button>
              </div>
            </div>
          );
        })}

      {/* Carrello */}
      <h2 className="text-xl font-bold mt-6 mb-2">Ordine</h2>
      <table className="min-w-full border mb-4">
        <thead>
          <tr className="bg-gray-200">
            <th className="px-2 py-1 border">Articolo</th>
            <th className="px-2 py-1 border">Taglia</th>
            <th className="px-2 py-1 border">Colore</th>
            <th className="px-2 py-1 border">Q.tà</th>
            <th className="px-2 py-1 border">Prezzo</th>
            <th className="px-2 py-1 border">Totale</th>
          </tr>
        </thead>
        <tbody>
          {carrello.map((r, i) => (
            <tr key={i}>
              <td className="border px-2 py-1">{r.articolo}</td>
              <td className="border px-2 py-1">{r.taglia}</td>
              <td className="border px-2 py-1">{r.colore}</td>
              <td className="border px-2 py-1">{r.ord}</td>
              <td className="border px-2 py-1">€{r.prezzo.toFixed(2)}</td>
              <td className="border px-2 py-1">€{(r.ord * r.prezzo).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-4">
        <div>Totale: €{totale.toFixed(2)}</div>
        <div>Totale scontato: €{totaleScontato.toFixed(2)}</div>
      </div>

      <div className="flex gap-2">
        <button onClick={exportCSV} className="bg-blue-600 text-white px-4 py-2 rounded">Esporta CSV</button>
        <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded">Esporta Excel</button>
        <button onClick={exportPDF} className="bg-red-600 text-white px-4 py-2 rounded">Esporta PDF</button>
      </div>
    </div>
  );
}

