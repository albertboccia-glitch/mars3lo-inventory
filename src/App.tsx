import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default function App() {
  // --- Stati generali ---
  const [stock, setStock] = useState<StockRow[]>([]);
  const [carrello, setCarrello] = useState<CarrelloRow[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);
  const [filtro, setFiltro] = useState("TUTTI");
  const [ricerca, setRicerca] = useState("");
  const [ordiniInput, setOrdiniInput] = useState<Record<string, Record<string, number>>>({});

  // --- Stati Bologna ---
  const [paginaBo, setPaginaBo] = useState<"magazzino" | "ordini" | "dettaglio">("magazzino");
  const [ordiniBo, setOrdiniBo] = useState<any[]>([]);
  const [ordineBoSelezionato, setOrdineBoSelezionato] = useState<any | null>(null);
  const [righeBo, setRigheBo] = useState<any[]>([]);

  // --- Stati Napoli ---
  const [paginaNapoli, setPaginaNapoli] = useState<"magazzino" | "ordini" | "dettaglio">("magazzino");
  const [ordini, setOrdini] = useState<any[]>([]);
  const [ordineSelezionato, setOrdineSelezionato] = useState<any | null>(null);
  const [righeOrdine, setRigheOrdine] = useState<any[]>([]);

  // --- Stati login ---
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [logged, setLogged] = useState(false);
  const [role, setRole] = useState<"BO" | "NA" | null>(null);
// ===============================
  // 🔹 INTERFACCIA BOLOGNA
  // ===============================
  if (role === "BO") {
    // Carica ordini evasi da Napoli
    const fetchOrdiniBo = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("stato", "Evaso")
        .order("created_at", { ascending: false });
      if (!error && data) setOrdiniBo(data);
    };

    // Apri ordine
    const apriOrdineBo = async (ordine: any) => {
      const { data: righe } = await supabase
        .from("order_lines")
        .select("*")
        .eq("order_id", ordine.id);
      setOrdineBoSelezionato(ordine);
      setRigheBo(righe || []);
      setPaginaBo("dettaglio");
    };

    return (
      <div className="min-h-screen bg-gray-100">
        {/* Barra nera */}
        <div className="bg-black p-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/mars3lo.png" alt="Mars3lo" className="h-10 mr-4" />
            <h1 className="text-white text-xl font-bold">Mars3lo B2B – Bologna</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                fetchOrdiniBo();
                setPaginaBo("ordini");
              }}
              className="bg-yellow-500 text-black px-4 py-2 rounded"
            >
              Notifiche Ordini
            </button>
          </div>
        </div>

        {/* Magazzino */}
        {paginaBo === "magazzino" && (
          <>
            {/* Qui ci va la UI completa del magazzino e carrello di Bologna
                (quella che già avevi funzionante, con cliente, sconto,
                griglia articoli, carrello, pulsanti invio ordine, export, ecc.) */}
          </>
        )}

        {/* Lista ordini evasi */}
        {paginaBo === "ordini" && (
          <div className="p-4">
            <h2 className="font-bold mb-4">Ordini evasi da Napoli</h2>
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
                {ordiniBo.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.customer}</td>
                    <td>{o.stato}</td>
                    <td>
                      <button
                        onClick={() => apriOrdineBo(o)}
                        className="bg-blue-600 text-white px-2 py-1 rounded"
                      >
                        Apri
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => setPaginaBo("magazzino")}
              className="mt-4 bg-gray-600 text-white px-4 py-2 rounded"
            >
              Torna indietro
            </button>
          </div>
        )}

        {/* Dettaglio ordine */}
        {paginaBo === "dettaglio" && ordineBoSelezionato && (
          <div className="p-4">
            <h2 className="font-bold mb-4">
              Ordine {ordineBoSelezionato.id} – {ordineBoSelezionato.customer}
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
                {righeBo.map((r) => (
                  <tr key={r.id}>
                    <td>{r.articolo}</td>
                    <td>{r.taglia}</td>
                    <td>{r.colore}</td>
                    <td>{r.richiesti}</td>
                    <td>{r.confermati}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => setPaginaBo("ordini")}
              className="mt-4 bg-gray-600 text-white px-4 py-2 rounded"
            >
              Torna indietro
            </button>
          </div>
        )}
      </div>
    );
  }
  // ===============================
  // 🔹 INTERFACCIA NAPOLI
  // ===============================
  if (role === "NA") {
    // Carica ordini da Supabase
    const fetchOrdini = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("stato", "In attesa")
        .order("created_at", { ascending: false });
      if (!error && data) setOrdini(data);
    };

    // Elimina ordine (solo dalla lista, non dal magazzino)
    const eliminaOrdine = async (id: string) => {
      if (!confirm("Vuoi eliminare questo ordine dalla lista?")) return;
      await supabase.from("orders").delete().eq("id", id);
      await supabase.from("order_lines").delete().eq("order_id", id);
      fetchOrdini();
    };

    // Apri ordine
    const apriOrdine = async (ordine: any) => {
      const { data: righe } = await supabase
        .from("order_lines")
        .select("*")
        .eq("order_id", ordine.id);
      setOrdineSelezionato(ordine);
      setRigheOrdine(righe || []);
      setPaginaNapoli("dettaglio");
    };

    // Conferma ordine
    const confermaOrdine = async () => {
      if (!ordineSelezionato) return;

      for (const r of righeOrdine) {
        await supabase
          .from("order_lines")
          .update({ confermati: r.confermati })
          .eq("id", r.id);
      }

      await supabase
        .from("orders")
        .update({ stato: "Evaso" })
        .eq("id", ordineSelezionato.id);

      // Scala magazzino (RPC già definita in Supabase)
      await supabase.rpc("scala_magazzino_da_ordini");

      alert("Ordine evaso!");
      setPaginaNapoli("ordini");
      fetchOrdini();
    };

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
              <button
                onClick={() => {
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
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded"
              >
                Esporta CSV
              </button>
              <button
                onClick={() => {
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
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded"
              >
                Esporta Excel
              </button>
              <button
                onClick={() => {
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
                }}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
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
 } // chiude if (role === "NA")

} // chiude export default function App
