import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Funzione classificazione categorie
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

// Ordinamento taglie
function sortTaglie(taglie: string[]): string[] {
  const numeric = taglie.filter(t => /^\d+$/.test(t)).map(Number).sort((a, b) => a - b).map(String);
  const letters = taglie.filter(t => /^[A-Z]+$/.test(t));
  const order = ["XS", "S", "M", "L", "XL", "XXL"];
  const lettersSorted = letters.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return [...numeric, ...lettersSorted];
}

interface StockRow {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
}

interface CarrelloItem extends StockRow {
  ord: number;
}

export default function App() {
  const [role, setRole] = useState<string | null>(null);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [carrello, setCarrello] = useState<CarrelloItem[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState("TUTTI");

  // Login semplice
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const handleLogin = () => {
    if (id === "Mars3loBo" && pw === "Francesco01") setRole("showroom");
    else if (id === "Mars3loNa" && pw === "Gbesse01") setRole("magazzino");
    else alert("Credenziali errate");
  };

  // Carica stock da Supabase
  useEffect(() => {
    if (!role) return;
    (async () => {
      const { data } = await supabase.from("stock").select("*");
      if (data) setStock(data as StockRow[]);
    })();
  }, [role]);

  // Aggiungi articoli al carrello
  const aggiungiAlCarrello = (gruppo: StockRow[], inputs: Record<string, number>) => {
    const nuovi = gruppo
      .filter(r => inputs[r.taglia] > 0)
      .map(r => ({
        ...r,
        ord: inputs[r.taglia]
      }));
    setCarrello(prev => {
      const altri = prev.filter(p => p.articolo !== gruppo[0].articolo || p.colore !== gruppo[0].colore);
      return [...altri, ...nuovi];
    });
  };

  const svuotaCarrello = () => setCarrello([]);

  // Esporta PDF ordine
  const esportaPDF = () => {
    const doc = new jsPDF();
    doc.text("Ordine Cliente: " + cliente, 10, 10);
    (doc as any).autoTable({
      head: [["Articolo", "Taglia", "Colore", "Q.tà", "Prezzo", "Totale"]],
      body: carrello.map(c => [
        c.articolo,
        c.taglia,
        c.colore,
        c.ord,
        "€" + Number(c.prezzo).toFixed(2),
        "€" + (c.ord * c.prezzo).toFixed(2)
      ])
    });
    const totale = carrello.reduce((s, c) => s + c.ord * c.prezzo, 0);
    const totScontato = totale * (1 - sconto / 100);
    doc.text(`Totale: €${totale.toFixed(2)}`, 10, (doc as any).lastAutoTable.finalY + 10);
    doc.text(`Totale scontato: €${totScontato.toFixed(2)}`, 10, (doc as any).lastAutoTable.finalY + 20);
    doc.save("ordine.pdf");
  };

  // Esporta Excel ordine
  const esportaExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      carrello.map(c => ({
        Articolo: c.articolo,
        Taglia: c.taglia,
        Colore: c.colore,
        Quantità: c.ord,
        Prezzo: Number(c.prezzo).toFixed(2),
        Totale: (c.ord * c.prezzo).toFixed(2)
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, "ordine.xlsx");
  };

  if (!role) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        <div className="p-6 bg-gray-900 rounded-lg">
          <img src="/public/public/mars3lo.png" alt="Mars3lo" className="mx-auto mb-4 w-32" />
          <h1 className="text-center mb-4">Login</h1>
          <input className="mb-2 p-2 w-full text-black" placeholder="ID" value={id} onChange={e => setId(e.target.value)} />
          <input className="mb-2 p-2 w-full text-black" type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} />
          <button className="bg-blue-600 w-full p-2" onClick={handleLogin}>Entra</button>
        </div>
      </div>
    );
  }

  // Raggruppa stock per articolo/colore
  const gruppi = Object.values(
    stock.reduce((acc: any, r) => {
      const key = r.articolo + "_" + r.colore;
      if (!acc[key]) acc[key] = { ...r, taglie: {} };
      acc[key].taglie[r.taglia] = r.qty;
      acc[key].prezzo = r.prezzo;
      return acc;
    }, {})
  );

  const filtrati = categoriaFiltro === "TUTTI"
    ? gruppi
    : gruppi.filter((g: any) => getCategoria(g.articolo) === categoriaFiltro);

  const totale = carrello.reduce((s, c) => s + c.ord * c.prezzo, 0);
  const totScontato = totale * (1 - sconto / 100);

  return (
    <div className="p-4">
      <div className="bg-black text-white flex items-center justify-center h-16 mb-4">
        <img src="/public/public/mars3lo.png" alt="logo" className="h-12 mr-2" />
        <span className="text-xl font-bold">MARS3LO B2B</span>
      </div>

      {role === "showroom" && (
        <>
          <div className="mb-4 flex flex-col sm:flex-row gap-2">
            <input className="p-2 border w-full" placeholder="Cliente" value={cliente} onChange={e => setCliente(e.target.value)} />
            <div className="flex items-center gap-2">
              <label>Sconto:</label>
              <input type="number" className="p-2 border w-20" value={sconto} onChange={e => setSconto(Number(e.target.value))} />%
            </div>
            <select className="p-2 border" value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}>
              <option value="TUTTI">Tutti</option>
              <option value="GIACCHE">Giacche</option>
              <option value="GIUBBOTTI">Giubbotti</option>
              <option value="MAGLIE">Maglie</option>
              <option value="PANTALONI">Pantaloni</option>
              <option value="PANTALONI FELPA">Pantaloni Felpa</option>
              <option value="CAPPOTTI">Cappotti</option>
              <option value="CAMICIE">Camicie</option>
            </select>
          </div>

          {filtrati.map((g: any) => {
            const taglie = sortTaglie(Object.keys(g.taglie));
            const [inputs, setInputs] = useState<Record<string, number>>({});
            return (
              <div key={g.articolo + g.colore} className="mb-6 border p-2 rounded">
                <h2 className="font-bold">{g.articolo} {getCategoria(g.articolo)} – {g.colore} – €{Number(g.prezzo).toFixed(2)}</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full border text-center">
                    <thead>
                      <tr>
                        {taglie.map(t => <th key={t} className="px-2 py-1">{t}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {taglie.map(t => <td key={t}>{g.taglie[t] ?? 0}</td>)}
                      </tr>
                      <tr>
                        {taglie.map(t => (
                          <td key={t}>
                            <input
                              type="number"
                              className="w-12 p-1 border"
                              value={inputs[t] || ""}
                              onChange={e => setInputs({ ...inputs, [t]: Number(e.target.value) })}
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="bg-green-500 text-white px-3 py-1" onClick={() => aggiungiAlCarrello(stock.filter(r => r.articolo === g.articolo && r.colore === g.colore), inputs)}>Aggiungi</button>
                  <button className="bg-red-500 text-white px-3 py-1" onClick={() => setCarrello(prev => prev.filter(c => c.articolo !== g.articolo || c.colore !== g.colore))}>Svuota</button>
                </div>
              </div>
            );
          })}

          <h2 className="font-bold text-xl mt-6">Ordine</h2>
          <table className="min-w-full border text-center">
            <thead>
              <tr>
                <th>Articolo</th><th>Taglia</th><th>Colore</th><th>Q.tà</th><th>Prezzo</th><th>Totale</th>
              </tr>
            </thead>
            <tbody>
              {carrello.map((c, i) => (
                <tr key={i}>
                  <td>{c.articolo}</td>
                  <td>{c.taglia}</td>
                  <td>{c.colore}</td>
                  <td>{c.ord}</td>
                  <td>€{Number(c.prezzo).toFixed(2)}</td>
                  <td>€{(c.ord * c.prezzo).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2">
            <p>Totale: €{totale.toFixed(2)}</p>
            <p>Totale scontato: €{totScontato.toFixed(2)}</p>
            <div className="flex gap-2 mt-2">
              <button className="bg-red-600 text-white px-3 py-1" onClick={svuotaCarrello}>Svuota Ordine</button>
              <button className="bg-blue-600 text-white px-3 py-1" onClick={esportaPDF}>Esporta PDF</button>
              <button className="bg-green-600 text-white px-3 py-1" onClick={esportaExcel}>Esporta Excel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

