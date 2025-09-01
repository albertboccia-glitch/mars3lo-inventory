import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

// 🔹 Configura Supabase (legge le env da Vercel)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// 🔹 Ordinamento taglie numeriche e alfabetiche
const sortTaglie = (arr: string[]) => {
  const orderLetters = ["XS", "S", "M", "L", "XL", "XXL"];
  return arr.sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);

    if (isNumA && isNumB) return numA - numB; // numeri
    if (!isNumA && !isNumB)
      return orderLetters.indexOf(a) - orderLetters.indexOf(b); // lettere
    return isNumA ? -1 : 1; // numeri prima delle lettere
  });
};

// 🔹 Categoria in base al codice
function getCategoria(code: string): string {
  const c = code.toUpperCase();
  if (c.startsWith("GB")) return "GIUBBOTTI";
  if (c.startsWith("MG")) return "MAGLIE";
  if (c.startsWith("PM")) return "PANTALONI FELPA";
  if (c.startsWith("CAP")) return "CAPPOTTI"; // 👈 aggiunta nuova categoria
  if (c.startsWith("P")) return "PANTALONI";
  if (c.startsWith("G")) return "GIACCHE";
  if (c.startsWith("C")) return "CAMICIE";
  return "ALTRO";
}

type StockRow = {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
};

type CarrelloRow = StockRow & { ordina: number };

export default function App() {
  const [user, setUser] = useState<null | { ruolo: string }>({ ruolo: "" });
  const [stock, setStock] = useState<StockRow[]>([]);
  const [carrello, setCarrello] = useState<CarrelloRow[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);

  // 🔹 Login fittizio
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [logged, setLogged] = useState(false);

  const handleLogin = () => {
    if (loginId === "Mars3loBo" && loginPw === "Francesco01") {
      setUser({ ruolo: "showroom" });
      setLogged(true);
    } else if (loginId === "Mars3loNa" && loginPw === "Gbesse01") {
      setUser({ ruolo: "magazzino" });
      setLogged(true);
    } else {
      alert("Credenziali errate");
    }
  };

  // 🔹 Carica stock da Supabase
  useEffect(() => {
    const fetchStock = async () => {
      let { data, error } = await supabase.from("stock").select("*");
      if (error) console.error(error);
      else
        setStock(
          (data as StockRow[]).map((r) => ({
            ...r,
            categoria: getCategoria(r.sku), // 👈 calcola categoria
          }))
        );
    };
    fetchStock();
  }, []);

  // 🔹 Raggruppamento articoli
  const grouped = stock.reduce((acc: any, row) => {
    const key = row.articolo + "_" + row.colore;
    if (!acc[key]) acc[key] = { ...row, taglie: [] as StockRow[] };
    acc[key].taglie.push(row);
    return acc;
  }, {});

  // 🔹 Aggiungi al carrello
  const addToCart = (rows: StockRow[], ordini: Record<string, number>) => {
    const nuovi = rows
      .map((r) =>
        ordini[r.taglia]
          ? { ...r, ordina: ordini[r.taglia] }
          : null
      )
      .filter(Boolean) as CarrelloRow[];
    // 🔹 Sostituisce eventuali righe già esistenti (non duplica)
    setCarrello((prev) => {
      const senza = prev.filter(
        (p) => !nuovi.find((n) => n.sku === p.sku)
      );
      return [...senza, ...nuovi];
    });
  };

  // 🔹 Svuota carrello
  const svuotaCarrello = () => setCarrello([]);

  // 🔹 Totali
  const totale = carrello.reduce(
    (sum, r) => sum + r.prezzo * r.ordina,
    0
  );
  const totaleScontato = totale * (1 - sconto / 100);

  // 🔹 Esporta CSV
  const esportaCSV = () => {
    const header = [
      "Articolo",
      "Categoria",
      "Taglia",
      "Colore",
      "Q.tà",
      "Prezzo",
      "Totale Riga",
    ];
    const rows = carrello.map((r) => [
      r.articolo,
      r.categoria,
      r.taglia,
      r.colore,
      r.ordina,
      r.prezzo.toFixed(2), // 👈 forza due decimali
      (r.ordina * r.prezzo).toFixed(2),
    ]);
    const csv = [header, ...rows]
      .map((x) => x.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ordine.csv";
    a.click();
  };

  // 🔹 Esporta Excel
  const esportaExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      carrello.map((r) => ({
        Articolo: r.articolo,
        Categoria: r.categoria,
        Taglia: r.taglia,
        Colore: r.colore,
        Quantità: r.ordina,
        Prezzo: r.prezzo.toFixed(2), // 👈 forza due decimali
        TotaleRiga: (r.ordina * r.prezzo).toFixed(2),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, "ordine.xlsx");
  };

  // 🔹 Invia ordine su Supabase
  const inviaOrdine = async () => {
    if (!cliente) {
      alert("Inserisci il nome cliente");
      return;
    }
    const orderId = Date.now().toString();
    const { error: ordErr } = await supabase.from("orders").insert([
      { id: orderId, customer: cliente, stato: "In attesa" },
    ]);
    if (ordErr) {
      console.error(ordErr);
      return;
    }
    const { error: linesErr } = await supabase.from("order_lines").insert(
      carrello.map((r) => ({
        order_id: orderId,
        sku: r.sku,
        articolo: r.articolo,
        taglia: r.taglia,
        colore: r.colore,
        richiesti: r.ordina,
        prezzo: r.prezzo,
      }))
    );
    if (linesErr) {
      console.error(linesErr);
      return;
    }
    alert("Ordine inviato!");
    svuotaCarrello();
  };

  // 🔹 UI Login
  if (!logged) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="bg-gray-900 p-8 rounded-xl w-80 text-center">
          <img
            src="/mars3lo.png"
            alt="Mars3lo"
            className="mx-auto mb-4 w-32"
          />
          <h1 className="text-white text-xl mb-4">Mars3lo B2B</h1>
          <input
            className="w-full mb-2 p-2 rounded"
            placeholder="ID"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
          />
          <input
            type="password"
            className="w-full mb-4 p-2 rounded"
            placeholder="Password"
            value={loginPw}
            onChange={(e) => setLoginPw(e.target.value)}
          />
          <button
            onClick={handleLogin}
            className="bg-red-600 text-white px-4 py-2 rounded w-full"
          >
            Accedi
          </button>
        </div>
      </div>
    );
  }

  // 🔹 UI principale
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Barra nera */}
      <div className="bg-black p-4 flex justify-center items-center">
        <img src="/mars3lo.png" alt="Mars3lo" className="h-10 mr-4" />
        <h1 className="text-white text-xl font-bold">Mars3lo B2B</h1>
      </div>

      {/* Cliente + Sconto */}
      <div className="p-4 flex gap-4 items-center">
        <input
          placeholder="Cliente"
          className="border p-2 rounded flex-1"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
        />
        <label className="flex items-center gap-2">
          Sconto:
          <input
            type="number"
            className="border p-2 rounded w-20"
            value={sconto}
            onChange={(e) => setSconto(parseInt(e.target.value) || 0)}
          />
          %
        </label>
      </div>

      {/* Griglia articoli */}
      <div className="p-4 space-y-6">
        {Object.values(grouped).map((gruppo: any) => {
          const rows: StockRow[] = sortTaglie(
            gruppo.taglie.map((t: StockRow) => t.taglia)
          ).map(
            (taglia) =>
              gruppo.taglie.find((t: StockRow) => t.taglia === taglia)!
          );

          const ordini: Record<string, number> = {};
          return (
            <div
              key={gruppo.sku}
              className="bg-white shadow rounded-lg p-4"
            >
              <h2 className="font-bold mb-2">
                {gruppo.articolo} {gruppo.categoria} – {gruppo.colore} – €
                {Number(gruppo.prezzo).toFixed(2)}
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-max border text-center">
                  <thead>
                    <tr>
                      <th className="px-2">Taglia</th>
                      {rows.map((r) => (
                        <th key={r.taglia} className="px-2">
                          {r.taglia}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-2">Disp.</td>
                      {rows.map((r) => (
                        <td key={r.taglia}>{r.qty}</td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2">Ordina</td>
                      {rows.map((r) => (
                        <td key={r.taglia}>
                          <input
                            type="number"
                            min={0}
                            max={r.qty}
                            className="w-16 p-1 border rounded"
                            onChange={(e) =>
                              (ordini[r.taglia] =
                                parseInt(e.target.value) || 0)
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => addToCart(rows, ordini)}
                  className="bg-green-600 text-white px-4 py-1 rounded"
                >
                  Aggiungi
                </button>
                <button
                  onClick={() =>
                    setCarrello((prev) =>
                      prev.filter(
                        (p) =>
                          !rows.find((r) => r.sku === p.sku)
                      )
                    )
                  }
                  className="bg-gray-600 text-white px-4 py-1 rounded"
                >
                  Svuota
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Carrello */}
      <div className="p-4 bg-white shadow mt-6">
        <h2 className="font-bold mb-2">Ordine</h2>
        <table className="w-full border">
          <thead>
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
            {carrello.map((r) => (
              <tr key={r.sku + r.taglia}>
                <td>{r.articolo}</td>
                <td>{r.taglia}</td>
                <td>{r.colore}</td>
                <td>{r.ordina}</td>
                <td>€{r.prezzo.toFixed(2)}</td>
                <td>€{(r.ordina * r.prezzo).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4">
          <p>Totale: €{totale.toFixed(2)}</p>
          <p>Totale scontato: €{totaleScontato.toFixed(2)}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={inviaOrdine}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Invia Ordine
          </button>
          <button
            onClick={esportaCSV}
            className="bg-gray-600 text-white px-4 py-2 rounded"
          >
            Esporta CSV
          </button>
          <button
            onClick={esportaExcel}
            className="bg-gray-600 text-white px-4 py-2 rounded"
          >
            Esporta Excel
          </button>
          <button
            onClick={svuotaCarrello}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Svuota Ordine
          </button>
        </div>
      </div>
    </div>
  );
}
