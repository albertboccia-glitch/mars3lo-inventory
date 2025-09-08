import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// Ordinamento taglie numeriche e alfabetiche
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

// Categoria in base al codice
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

  // --- Login handler ---
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

  // --- Carica stock ---
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

  // --- UI Login ---
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

  // --- BLOCCO 1: Bologna ---
  if (role === "BO") {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Barra nera */}
        <div className="bg-black p-4 flex justify-center items-center">
          <img src="/mars3lo.png" alt="Mars3lo" className="h-10 mr-4" />
          <h1 className="text-white text-xl font-bold">Mars3lo B2B – Bologna</h1>
        </div>

        {/* Magazzino con carrello e invio ordini */}
        {/* Qui va tutto il codice di Bologna (griglia articoli, carrello, invio ordine, esportazioni, notifiche) */}
      </div>
    );
  }

  // --- BLOCCO 2: Napoli ---
  if (role === "NA") {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Barra nera */}
        <div className="bg-black p-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/mars3lo.png" alt="Mars3lo" className="h-10 mr-4" />
            <h1 className="text-white text-xl font-bold">Mars3lo B2B – Napoli</h1>
          </div>
          <div>
            <button
              onClick={async () => {
                const { data, error } = await supabase
                  .from("orders")
                  .select("*")
                  .eq("stato", "In attesa")
                  .order("created_at", { ascending: false });
                if (!error && data) {
                  setOrdini(data);
                  setPaginaNapoli("ordini");
                }
              }}
              className="bg-yellow-500 text-black px-4 py-2 rounded"
            >
              Ordini
            </button>
          </div>
        </div>

        {/* Magazzino Napoli */}
        {paginaNapoli === "magazzino" && (
          <div className="p-4">
            <h2 className="font-bold mb-4">Magazzino Napoli</h2>
            <table className="w-full border">
              <thead>
                <tr>
                  <th>Articolo</th>
                  <th>Categoria</th>
                  <th>Taglia</th>
                  <th>Colore</th>
                  <th>Disponibili</th>
                  <th>Prezzo</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((r) => (
                  <tr key={r.sku}>
                    <td>{r.articolo}</td>
                    <td>{r.categoria}</td>
                    <td>{r.taglia}</td>
                    <td>{r.colore}</td>
                    <td>{r.qty}</td>
                    <td>€{Number(r.prezzo).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Lista ordini da evadere */}
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
                    <td>
                      <button
                        onClick={async () => {
                          const { data: righe } = await supabase
                            .from("order_lines")
                            .select("*")
                            .eq("order_id", o.id);
                          setOrdineSelezionato(o);
                          setRigheOrdine(righe || []);
                          setPaginaNapoli("dettaglio");
                        }}
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
                {righeOrdine.map((r) => (
                  <tr key={r.id}>
                    <td>{r.articolo}</td>
                    <td>{r.taglia}</td>
                    <td>{r.colore}</td>
                    <td>{r.richiesti}</td>
                    <td>
                      <input
                        type="number"
                        defaultValue={r.richiesti}
                        className="border w-16 p-1 rounded"
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setRigheOrdine((prev) =>
                            prev.map((rr) =>
                              rr.id === r.id ? { ...rr, confermati: val } : rr
                            )
                          );
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => {
                  for (let r of righeOrdine) {
                    await supabase
                      .from("order_lines")
                      .update({ confermati: r.confermati ?? r.richiesti })
                      .eq("id", r.id);
                    await supabase
                      .from("stock")
                      .update({ qty: r.qty - (r.confermati ?? r.richiesti) })
                      .eq("sku", r.sku);
                  }
                  await supabase
                    .from("orders")
                    .update({ stato: "Evaso" })
                    .eq("id", ordineSelezionato.id);
                  alert("Ordine evaso!");
                  setPaginaNapoli("ordini");
                }}
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

  // --- Fallback ---
  return (
    <div className="p-8 text-center">
      <h2>Interfaccia non disponibile</h2>
    </div>
  );
}
