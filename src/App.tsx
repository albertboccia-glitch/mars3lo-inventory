import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

// 🔹 Configura Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// 🔹 Ordinamento taglie
const sortTaglie = (arr: string[]) => {
  const orderLetters = ["XS", "S", "M", "L", "XL", "XXL"];
  return arr.sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);

    if (isNumA && isNumB) return numA - numB;
    if (!isNumA && !isNumB)
      return orderLetters.indexOf(a) - orderLetters.indexOf(b);
    return isNumA ? -1 : 1;
  });
};

// 🔹 Categoria
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

type Order = {
  id: string;
  created_at: string;
  customer: string;
  stato: string;
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

export default function App() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [carrello, setCarrello] = useState<CarrelloRow[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);
  const [filtro, setFiltro] = useState("TUTTI");
  const [ricerca, setRicerca] = useState("");
  const [ordiniInput, setOrdiniInput] = useState<Record<string, Record<string, number>>>({});
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [logged, setLogged] = useState(false);
  const [role, setRole] = useState<"BO" | "NA" | null>(null);

  // 🔹 Login
  const handleLogin = () => {
    if (loginId === "Mars3loBo" && loginPw === "Francesco01") {
      setLogged(true);
      setRole("BO");
    } else if (loginId === "Mars3loNa" && loginPw === "Gbesse01") {
      setLogged(true);
      setRole("NA");
    } else {
      alert("Credenziali errate");
    }
  };

  // 🔹 Carica stock
  useEffect(() => {
    const fetchStock = async () => {
      let { data, error } = await supabase.from("stock").select("*");
      if (error) console.error(error);
      else
        setStock(
          (data as StockRow[]).map((r) => ({
            ...r,
            categoria: getCategoria(r.sku),
          }))
        );
    };
    fetchStock();
  }, []);

  // 🔹 Filtraggio
  const filteredStock = stock.filter(
    (s) =>
      (filtro === "TUTTI" || s.categoria === filtro) &&
      (s.articolo.toLowerCase().includes(ricerca.toLowerCase()) ||
        s.sku.toLowerCase().includes(ricerca.toLowerCase()))
  );

  // 🔹 Raggruppamento
  const grouped = filteredStock.reduce((acc: any, row) => {
    const key = row.articolo + "_" + row.colore;
    if (!acc[key]) acc[key] = { ...row, taglie: [] as StockRow[] };
    acc[key].taglie.push(row);
    return acc;
  }, {});

  // 🔹 Aggiungi al carrello
  const addToCart = (rows: StockRow[], ordini: Record<string, number>) => {
    const nuovi = rows
      .map((r) =>
        ordini[r.taglia] ? { ...r, ordina: ordini[r.taglia] } : null
      )
      .filter(Boolean) as CarrelloRow[];
    setCarrello((prev) => {
      const senza = prev.filter((p) => !nuovi.find((n) => n.sku === p.sku));
      return [...senza, ...nuovi];
    });
  };

  // 🔹 Svuota carrello
  const svuotaCarrello = () => {
    setCarrello([]);
    setOrdiniInput({});
  };

  // 🔹 Totali
  const totale = carrello.reduce((sum, r) => sum + r.prezzo * r.ordina, 0);
  const totaleScontato = totale * (1 - sconto / 100);

  // 🔹 Invia ordine
  const inviaOrdine = async () => {
    if (!cliente) {
      alert("Inserisci il nome cliente");
      return;
    }
    const year = new Date().getFullYear().toString().slice(-2);
    const { count } = await supabase.from("orders").select("*", { count: "exact" });
    const orderId = `${(count || 0) + 1}/${year}`;
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
          <img src="/mars3lo.png" alt="Mars3lo" className="mx-auto mb-4 w-32" />
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

  // ===============================
  // 🔹 INTERFACCIA BOLOGNA
  // ===============================
  if (role === "BO") {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Barra nera */}
        <div className="bg-black p-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/mars3lo.png" alt="Mars3lo" className="h-10 mr-4" />
            <h1 className="text-white text-xl font-bold">Mars3lo B2B – Bologna</h1>
          </div>
          <button
            onClick={() => alert("Qui si aprirà la lista notifiche ordini evasi")}
            className="bg-yellow-500 text-black px-4 py-2 rounded"
          >
            Notifiche Ordini
          </button>
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

        {/* Filtro categorie + ricerca */}
        <div className="px-4 mb-4 flex flex-wrap gap-4 items-center">
          <div>
            <label className="mr-2">Categoria:</label>
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="TUTTI">Tutti</option>
              <option value="GIACCHE">Giacche</option>
              <option value="PANTALONI">Pantaloni</option>
              <option value="GIUBBOTTI">Giubbotti</option>
              <option value="MAGLIE">Maglie</option>
              <option value="CAPPOTTI">Cappotti</option>
              <option value="CAMICIE">Camicie</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Cerca per codice o articolo..."
            className="border p-2 rounded flex-1"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
        </div>

        {/* Griglia articoli */}
        <div className="p-4 space-y-6">
          {Object.values(grouped).map((gruppo: any) => {
            const rows: StockRow[] = sortTaglie(
              gruppo.taglie.map((t: StockRow) => t.taglia)
            ).map((taglia) =>
              gruppo.taglie.find((t: StockRow) => t.taglia === taglia)!
            );

            return (
              <div key={gruppo.sku} className="bg-white shadow rounded-lg p-4">
                {/* 🔹 qui niente SKU ripetuto */}
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
                              value={ordiniInput[gruppo.sku]?.[r.taglia] || 0}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setOrdiniInput((prev) => ({
                                  ...prev,
                                  [gruppo.sku]: {
                                    ...prev[gruppo.sku],
                                    [r.taglia]: val,
                                  },
                                }));
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => addToCart(rows, ordiniInput[gruppo.sku] || {})}
                    className="bg-green-600 text-white px-4 py-1 rounded"
                  >
                    Aggiungi
                  </button>
                  <button
                    onClick={() => {
                      setCarrello((prev) =>
                        prev.filter(
                          (p) => !rows.find((r) => r.sku === p.sku)
                        )
                      );
                      setOrdiniInput((prev) => {
                        const copia = { ...prev };
                        delete copia[gruppo.sku];
                        return copia;
                      });
                    }}
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
            <button onClick={inviaOrdine} className="bg-blue-600 text-white px-4 py-2 rounded">
              Invia Ordine
            </button>
            <button onClick={svuotaCarrello} className="bg-red-600 text-white px-4 py-2 rounded">
              Svuota Ordine
            </button>
          </div>
        </div>
      </div>
    );
  }
  // ===============================
  // 🔹 INTERFACCIA NAPOLI
  // ===============================
  if (role === "NA") {
    const [paginaNapoli, setPaginaNapoli] = useState<"magazzino" | "ordini" | "dettaglio">("magazzino");
    const [ordini, setOrdini] = useState<any[]>([]);
    const [ordineSelezionato, setOrdineSelezionato] = useState<any | null>(null);
    const [righeOrdine, setRigheOrdine] = useState<any[]>([]);

    // 🔹 Carica ordini da Supabase
    const fetchOrdini = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) setOrdini(data);
    };

    // 🔹 Elimina ordine (solo dalla lista, non magazzino)
    const eliminaOrdine = async (id: string) => {
      if (!confirm("Vuoi eliminare questo ordine dalla lista?")) return;
      await supabase.from("orders").delete().eq("id", id);
      await supabase.from("order_lines").delete().eq("order_id", id);
      fetchOrdini();
    };

    // 🔹 Apri ordine in dettaglio
    const apriOrdine = async (ordine: any) => {
      const { data: righe } = await supabase
        .from("order_lines")
        .select("*")
        .eq("order_id", ordine.id);
      setOrdineSelezionato(ordine);
      setRigheOrdine(righe || []);
      setPaginaNapoli("dettaglio");
    };

    // 🔹 Conferma ordine
    const confermaOrdine = async () => {
      if (!ordineSelezionato) return;
      for (const r of righeOrdine) {
        await supabase
          .from("order_lines")
          .update({ confermati: r.confermati })
          .eq("id", r.id);
      }
      await supabase.from("orders").update({ stato: "Evaso" }).eq("id", ordineSelezionato.id);
      await supabase.rpc("scala_magazzino_da_ordini");
      alert("Ordine evaso!");
      setPaginaNapoli("ordini");
      fetchOrdini();
    };

    // 🔹 Funzioni export magazzino
    const esportaMagazzinoCSV = () => {
      const header = ["Articolo", "Categoria", "Taglia", "Colore", "Q.tà", "Prezzo"];
      const rows = stock.map((r) => [
        r.articolo,
        r.categoria,
        r.taglia,
        r.colore,
        r.qty,
        r.prezzo.toFixed(2),
      ]);
      const csv = [header, ...rows].map((x) => x.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "magazzino.csv";
      a.click();
    };

    const esportaMagazzinoExcel = () => {
      const ws = XLSX.utils.json_to_sheet(
        stock.map((r) => ({
          Articolo: r.articolo,
          Categoria: r.categoria,
          Taglia: r.taglia,
          Colore: r.colore,
          Quantità: r.qty,
          Prezzo: r.prezzo.toFixed(2),
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Magazzino");
      XLSX.writeFile(wb, "magazzino.xlsx");
    };

    const esportaMagazzinoPDF = () => {
      const doc = new jsPDF();
      doc.text("Magazzino Napoli", 10, 10);
      (doc as any).autoTable({
        head: [["Articolo", "Categoria", "Taglia", "Colore", "Q.tà", "Prezzo"]],
        body: stock.map((r) => [
          r.articolo,
          r.categoria,
          r.taglia,
          r.colore,
          r.qty,
          `€${r.prezzo.toFixed(2)}`,
        ]),
      });
      doc.save("magazzino.pdf");
    };

    // 🔹 Render Napoli
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Barra nera */}
        <div className="bg-black p-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/mars3lo.png" alt="Mars3lo" className="h-10 mr-4" />
            <h1 className="text-white text-xl font-bold">Mars3lo B2B – Napoli</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                fetchOrdini();
                setPaginaNapoli("ordini");
              }}
              className="bg-yellow-500 text-black px-4 py-2 rounded"
            >
              Ordini
            </button>
          </div>
        </div>

        {/* Magazzino */}
        {paginaNapoli === "magazzino" && (
          <>
            {/* Filtro categorie + ricerca */}
            <div className="px-4 mb-4 flex flex-wrap gap-4 items-center">
              <div>
                <label className="mr-2">Categoria:</label>
                <select
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="border p-2 rounded"
                >
                  <option value="TUTTI">Tutti</option>
                  <option value="GIACCHE">Giacche</option>
                  <option value="PANTALONI">Pantaloni</option>
                  <option value="GIUBBOTTI">Giubbotti</option>
                  <option value="MAGLIE">Maglie</option>
                  <option value="CAPPOTTI">Cappotti</option>
                  <option value="CAMICIE">Camicie</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Cerca per codice o articolo..."
                className="border p-2 rounded flex-1"
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
              />
            </div>

            {/* Griglia articoli */}
            <div className="p-4 space-y-6">
              {Object.values(grouped).map((gruppo: any) => {
                const rows: StockRow[] = sortTaglie(
                  gruppo.taglie.map((t: StockRow) => t.taglia)
                ).map((taglia) =>
                  gruppo.taglie.find((t: StockRow) => t.taglia === taglia)!
                );

                return (
                  <div key={gruppo.sku} className="bg-white shadow rounded-lg p-4">
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
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pulsanti export */}
            <div className="p-4 bg-white shadow mt-6 flex flex-wrap gap-2">
              <button onClick={esportaMagazzinoCSV} className="bg-gray-600 text-white px-4 py-2 rounded">
                Esporta CSV
              </button>
              <button onClick={esportaMagazzinoExcel} className="bg-gray-600 text-white px-4 py-2 rounded">
                Esporta Excel
              </button>
              <button onClick={esportaMagazzinoPDF} className="bg-red-600 text-white px-4 py-2 rounded">
                Esporta PDF
              </button>
            </div>
          </>
        )}

        {/* Lista ordini */}
        {paginaNapoli === "ordini" && (
          <div className="p-4">
            <h2 className="font-bold mb-4">Ordini da evadere</h2>
            <table className="w-full border">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {ordini.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.customer}</td>
                    <td>{o.stato}</td>
                    <td className="flex gap-2">
                      <button
                        onClick={() => apriOrdine(o)}
                        className="bg-blue-600 text-white px-2 py-1 rounded"
                      >
                        Apri
                      </button>
                      <button
                        onClick={() => eliminaOrdine(o.id)}
                        className="bg-red-600 text-white px-2 py-1 rounded"
                      >
                        X
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => setPaginaNapoli("magazzino")}
              className="mt-4 bg-gray-600 text-white px-4 py-2 rounded"
            >
              Torna indietro
            </button>
          </div>
        )}

        {/* Dettaglio ordine */}
        {paginaNapoli === "dettaglio" && ordineSelezionato && (
          <div className="p-4">
            <h2 className="font-bold mb-4">
              Ordine {ordineSelezionato.id} – {ordineSelezionato.customer}
            </h2>
            <table className="w-full border">
              <thead>
                <tr>
                  <th>Articolo</th>
                  <th>Taglia</th>
                  <th>Colore</th>
                  <th>Richiesti</th>
                  <th>Confermati</th>
                </tr>
              </thead>
              <tbody>
                {righeOrdine.map((r, idx) => (
                  <tr key={r.id}>
                    <td>{r.articolo}</td>
                    <td>{r.taglia}</td>
                    <td>{r.colore}</td>
                    <td>{r.richiesti}</td>
                    <td>
                      <input
                        type="number"
                        value={r.confermati || 0}
                        min={0}
                        max={r.richiesti}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setRigheOrdine((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, confermati: val } : x
                            )
                          );
                        }}
                        className="w-16 border p-1 rounded"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex gap-2">
              <button
                onClick={confermaOrdine}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Conferma Ordine
              </button>
              <button
                onClick={() => setPaginaNapoli("ordini")}
                className="bg-gray-600 text-white px-4 py-2 rounded"
              >
                Torna indietro
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // fallback
  return <div>Ruolo non riconosciuto</div>;
}

