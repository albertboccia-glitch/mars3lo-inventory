
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

// Supabase init
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// categorie leggibili
const CATEGORIE_LABELS: Record<string, string> = {
  G: "Giacche",
  P: "Pantaloni",
  GB: "Giubbotti",
  MG: "Maglie",
  PM: "Pantaloni Felpa",
  C: "Camicie",
};

// tipi
interface StockRow {
  sku: string;
  articolo: string;
  categoria: string;
  colore: string;
  taglia: string;
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

function App() {
  // login
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<"showroom" | "magazzino" | null>(null);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  // dati
  const [stock, setStock] = useState<StockRow[]>([]);
  const [carrello, setCarrello] = useState<CartRow[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);

  // fetch stock
  const loadStock = async () => {
    const { data, error } = await supabase.from("stock").select("*");
    if (!error && data) setStock(data as StockRow[]);
  };
  useEffect(() => {
    if (loggedIn) loadStock();
  }, [loggedIn]);

  // realtime
  useEffect(() => {
    if (!loggedIn) return;
    const sub = supabase
      .channel("stock-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock" }, loadStock)
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [loggedIn]);

  // login handler
  const handleLogin = (user: string, pass: string) => {
    if (user === "Mars3loBo" && pass === "Francesco01") {
      setRole("showroom");
      setLoggedIn(true);
    } else if (user === "Mars3loNa" && pass === "Gbesse01") {
      setRole("magazzino");
      setLoggedIn(true);
    } else {
      alert("Credenziali errate");
    }
  };

  // aggiunta carrello
  const addToCart = (row: CartRow) => {
    setCarrello((prev) => [...prev, row]);
  };

  // esporta PDF ordine
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.addImage("/public/mars3lo.png", "PNG", 10, 10, 40, 20);
    doc.setFontSize(16);
    doc.text("Ordine Cliente", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Cliente: ${cliente}`, 14, 40);

    const rows = carrello.map((c) => [
      c.articolo,
      c.colore,
      c.taglia,
      c.richiesti,
      "€ " + c.prezzo.toFixed(2),
      "€ " + (c.prezzo * c.richiesti).toFixed(2),
    ]);

    (doc as any).autoTable({
      head: [["Articolo", "Colore", "Taglia", "Q.tà", "Prezzo", "Totale"]],
      body: rows,
      startY: 50,
    });

    const totale = carrello.reduce((s, c) => s + c.prezzo * c.richiesti, 0);
    const scontoVal = (totale * sconto) / 100;
    const imponibile = totale - scontoVal;

    doc.text(`Totale: € ${totale.toFixed(2)}`, 14, (doc as any).lastAutoTable.finalY + 10);
    doc.text(`Sconto: ${sconto}% ( -€ ${scontoVal.toFixed(2)} )`, 14, (doc as any).lastAutoTable.finalY + 20);
    doc.text(`Imponibile: € ${imponibile.toFixed(2)}`, 14, (doc as any).lastAutoTable.finalY + 30);

    doc.save("ordine.pdf");
  };

  // export Excel
  const exportExcel = () => {
    const rows = carrello.map((c) => ({
      Articolo: c.articolo,
      Colore: c.colore,
      Taglia: c.taglia,
      Quantità: c.richiesti,
      Prezzo: c.prezzo,
      Totale: c.prezzo * c.richiesti,
      Cliente: cliente,
      Sconto: sconto,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), "ordine.xlsx");
  };

  // --- LOGIN PAGE ---
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

  // --- MAIN ---
  return (
    <div className="p-4">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <img src="/public/mars3lo.png" alt="Mars3lo Logo" className="w-32" />
        <div>
          <input
            placeholder="Nome Cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className="border p-2 mr-2"
          />
          <input
            type="number"
            placeholder="Sconto %"
            value={sconto}
            onChange={(e) => setSconto(parseFloat(e.target.value))}
            className="border p-2 w-24"
          />
        </div>
      </div>

      {/* STOCK LISTA */}
      <h2 className="text-xl font-bold mb-2">Magazzino</h2>
      <table className="w-full border mb-6">
        <thead>
          <tr className="bg-gray-200">
            <th>Codice</th>
            <th>Categoria</th>
            <th>Colore</th>
            <th>Taglia</th>
            <th>Q.tà</th>
            <th>Prezzo</th>
            <th>Azione</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((r) => (
            <tr key={r.sku} className="border-t">
              <td>{r.articolo}</td>
              <td>{CATEGORIE_LABELS[r.categoria] || r.categoria}</td>
              <td className="font-bold">{r.colore}</td>
              <td>{r.taglia}</td>
              <td>{r.qty}</td>
              <td>€ {r.prezzo.toFixed(2)}</td>
              <td>
                <input type="number" min={0} max={r.qty} className="border p-1 w-16" id={`qty-${r.sku}`} />
                <button
                  onClick={() => {
                    const val = parseInt(
                      (document.getElementById(`qty-${r.sku}`) as HTMLInputElement)?.value || "0"
                    );
                    if (val > 0) {
                      addToCart({
                        sku: r.sku,
                        articolo: r.articolo,
                        colore: r.colore,
                        taglia: r.taglia,
                        richiesti: val,
                        prezzo: r.prezzo,
                      });
                    }
                  }}
                  className="ml-2 bg-black text-white px-2 py-1 rounded"
                >
                  Aggiungi
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* CARRELLO */}
      <h2 className="text-xl font-bold mb-2">Carrello</h2>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
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
            <tr key={i} className="border-t">
              <td>{c.articolo}</td>
              <td>{c.colore}</td>
              <td>{c.taglia}</td>
              <td>{c.richiesti}</td>
              <td>€ {c.prezzo.toFixed(2)}</td>
              <td>€ {(c.richiesti * c.prezzo).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totali */}
      <div className="mt-4 text-right">
        {(() => {
          const totale = carrello.reduce((s, c) => s + c.prezzo * c.richiesti, 0);
          const scontoVal = (totale * sconto) / 100;
          const imponibile = totale - scontoVal;
          return (
            <>
              <p>Totale: € {totale.toFixed(2)}</p>
              <p>Sconto: {sconto}% ( -€ {scontoVal.toFixed(2)} )</p>
              <p className="font-bold">Imponibile: € {imponibile.toFixed(2)}</p>
            </>
          );
        })()}
      </div>

      {/* Export */}
      <div className="mt-4 flex gap-2 justify-end">
        <button onClick={exportPDF} className="bg-red-500 text-white px-4 py-2 rounded">Stampa PDF</button>
        <button onClick={exportExcel} className="bg-green-500 text-white px-4 py-2 rounded">Esporta Excel</button>
      </div>
    </div>
  );
}

export default App;
