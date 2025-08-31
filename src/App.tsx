import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ✅ Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// ✅ Credenziali fisse
const CREDENTIALS = {
  showroom: { id: "Mars3loBo", pw: "Francesco01" },
  magazzino: { id: "Mars3loNa", pw: "Gbesse01" },
};

// ✅ Tipi
type StockRow = {
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
  colore: string;
  taglia: string;
  richiesti: number;
  prezzo: number;
};

export default function App() {
  // --- Stato login
  const [role, setRole] = useState<"showroom" | "magazzino" | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  // --- Stato stock e ordini
  const [stock, setStock] = useState<StockRow[]>([]);
  const [carrello, setCarrello] = useState<OrderLine[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);

  // --- UI
  const [view, setView] = useState<"griglia" | "lista">("griglia");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");

  // --- Login
  const handleLogin = (id: string, pw: string) => {
    if (id === CREDENTIALS.showroom.id && pw === CREDENTIALS.showroom.pw) {
      setRole("showroom");
      setLoggedIn(true);
    } else if (id === CREDENTIALS.magazzino.id && pw === CREDENTIALS.magazzino.pw) {
      setRole("magazzino");
      setLoggedIn(true);
    } else {
      alert("Credenziali errate");
    }
  };

  // --- Carica stock da Supabase
  useEffect(() => {
    if (!loggedIn) return;
    const fetchStock = async () => {
      const { data, error } = await supabase.from("stock").select("*");
      if (error) console.error(error);
      else setStock(data as StockRow[]);
    };
    fetchStock();

    // realtime
    const sub = supabase
      .channel("stock-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock" }, fetchStock)
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [loggedIn]);

  // --- Carrello
  const addToCart = (line: OrderLine) => {
    if (line.richiesti <= 0) return;
    setCarrello((prev) => [...prev, line]);
  };

  // --- Totali
  const totaleLordo = carrello.reduce((sum, r) => sum + r.richiesti * r.prezzo, 0);
  const totaleImponibile = totaleLordo * (1 - sconto / 100);

  // --- Export PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.addImage("/public/mars3lo.png", "PNG", 10, 10, 40, 20);
    doc.setFontSize(18);
    doc.text("Ordine Cliente", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Cliente: ${cliente}`, 10, 40);
    autoTable(doc, {
      startY: 50,
      head: [["Articolo", "Colore", "Taglia", "Qtà", "Prezzo", "Totale"]],
      body: carrello.map((r) => [
        r.articolo,
        r.colore,
        r.taglia,
        r.richiesti,
        r.prezzo.toFixed(2),
        (r.richiesti * r.prezzo).toFixed(2),
      ]),
    });
    doc.text(`Totale Lordo: €${totaleLordo.toFixed(2)}`, 10, doc.lastAutoTable.finalY + 10);
    doc.text(`Sconto: ${sconto}%`, 10, doc.lastAutoTable.finalY + 20);
    doc.text(`Totale Imponibile: €${totaleImponibile.toFixed(2)}`, 10, doc.lastAutoTable.finalY + 30);
    doc.save(`ordine_${cliente}.pdf`);
  };

  // --- Export Excel
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      carrello.map((r) => ({
        Cliente: cliente,
        Articolo: r.articolo,
        Colore: r.colore,
        Taglia: r.taglia,
        Quantità: r.richiesti,
        Prezzo: r.prezzo,
        Totale: r.richiesti * r.prezzo,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), `ordine_${cliente}.xlsx`);
  };

  // --- Export CSV
  const exportCSV = () => {
    const rows = [
      ["Cliente", "Articolo", "Colore", "Taglia", "Quantità", "Prezzo", "Totale"],
      ...carrello.map((r) => [
        cliente,
        r.articolo,
        r.colore,
        r.taglia,
        r.richiesti,
        r.prezzo,
        r.richiesti * r.prezzo,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `ordine_${cliente}.csv`);
  };

  // --- Raggruppa stock per articolo+colore
  const groupByArticoloColore = () => {
    const groups: Record<string, StockRow[]> = {};
    stock
      .filter((r) => !categoriaFiltro || r.categoria === categoriaFiltro)
      .forEach((r) => {
        const key = `${r.articolo}-${r.colore}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });
    return groups;
  };

  // --- LOGIN SCREEN ---
  if (!loggedIn) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <img src="/public/mars3lo.png" alt="Mars3lo Logo" className="mx-auto mb-6 w-40" />
          <h1 className="text-2xl mb-4">Accesso</h1>
          <input
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="block mb-2 p-2 text-black w-64 mx-auto"
          />
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="block mb-4 p-2 text-black w-64 mx-auto"
          />
          <button
            onClick={() => handleLogin(id, pw)}
            className="bg-white text-black px-4 py-2 rounded"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  return (
    <div className="p-4">
      <header className="flex justify-between items-center mb-4">
        <img src="/public/mars3lo.png" alt="Mars3lo Logo" className="w-32" />
        <div>
          <input
            placeholder="Nome cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className="border p-2 mr-2"
          />
          <input
            type="number"
            placeholder="Sconto %"
            value={sconto}
            onChange={(e) => setSconto(parseFloat(e.target.value))}
            className="border p-2 w-20"
          />
        </div>
      </header>

      <div className="mb-4 flex justify-between">
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="border p-2"
        >
          <option value="">Tutte le categorie</option>
          <option value="G">Giacche</option>
          <option value="P">Pantaloni</option>
          <option value="GB">Giubbotti</option>
          <option value="MG">Maglie</option>
          <option value="PM">Pantaloni Felpa</option>
          <option value="C">Camicie</option>
        </select>

        <div>
          <button
            className={`px-4 py-2 mr-2 ${view === "griglia" ? "bg-black text-white" : "bg-gray-200"}`}
            onClick={() => setView("griglia")}
          >
            Griglia
          </button>
          <button
            className={`px-4 py-2 ${view === "lista" ? "bg-black text-white" : "bg-gray-200"}`}
            onClick={() => setView("lista")}
          >
            Lista
          </button>
        </div>
      </div>

      {/* LISTA */}
      {view === "lista" ? (
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th>Codice</th>
              <th>Categoria</th>
              <th>Colore</th>
              <th>Taglia</th>
              <th>Disponibili</th>
              <th>Prezzo</th>
              {role === "showroom" && <th>Ordina</th>}
            </tr>
          </thead>
          <tbody>
            {stock
              .filter((r) => !categoriaFiltro || r.categoria === categoriaFiltro)
              .map((r) => (
                <tr key={r.sku} className="border-t">
                  <td>{r.sku}</td>
                  <td>{r.categoria}</td>
                  <td className="font-bold">{r.colore}</td>
                  <td>{r.taglia}</td>
                  <td>{r.qty}</td>
                  <td>€ {r.prezzo.toFixed(2)}</td>
                  {role === "showroom" && (
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={r.qty}
                        className="border p-1 w-16"
                        onBlur={(e) =>
                          addToCart({
                            sku: r.sku,
                            articolo: r.articolo,
                            colore: r.colore,
                            taglia: r.taglia,
                            richiesti: parseInt(e.target.value) || 0,
                            prezzo: r.prezzo,
                          })
                        }
                      />
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        /* GRIGLIA TAGLIE ORIZZONTALE */
        <div>
          {Object.entries(groupByArticoloColore()).map(([key, righe]) => (
            <div key={key} className="mb-6 border p-3">
              <h3 className="font-bold text-lg mb-2">
                {righe[0].articolo} {righe[0].categoria} –{" "}
                <span className="font-bold">{righe[0].colore}</span> (€{righe[0].prezzo.toFixed(2)})
              </h3>
              <table className="w-full text-center border text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    {righe.map((r) => (
                      <th key={r.taglia}>{r.taglia}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {righe.map((r) => (
                      <td key={r.taglia} className="p-1 border">
                        {r.qty}
                      </td>
                    ))}
                  </tr>
                  {role === "showroom" && (
                    <tr>
                      {righe.map((r) => (
                        <td key={r.taglia} className="p-1 border">
                          <input
                            type="number"
                            min={0}
                            max={r.qty}
                            className="w-16 border p-1"
                            onBlur={(e) =>
                              addToCart({
                                sku: r.sku,
                                articolo: r.articolo,
                                colore: r.colore,
                                taglia: r.taglia,
                                richiesti: parseInt(e.target.value) || 0,
                                prezzo: r.prezzo,
                              })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* CARRELLO */}
      {role === "showroom" && (
        <div className="mt-6 border-t pt-4">
          <h2 className="text-xl mb-2">Carrello</h2>
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th>Articolo</th>
                <th>Colore</th>
                <th>Taglia</th>
                <th>Qtà</th>
                <th>Prezzo</th>
                <th>Totale</th>
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
    </tr>
  ))}
</tbody>
