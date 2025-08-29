import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// In Vercel le chiavi arrivano da Environment Variables
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

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
  taglia: string;
  colore: string;
  richiesti: number;
  prezzo: number;
};

export default function App() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [grouped, setGrouped] = useState<any[]>([]);
  const [carrello, setCarrello] = useState<OrderLine[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);
  const [isMagazzino, setIsMagazzino] = useState(false);
  const [pin, setPin] = useState("");

  // Carica stock da Supabase
  useEffect(() => {
    loadStock();
    const channel = supabase
      .channel("stock-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock" },
        () => {
          loadStock();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadStock() {
    const { data, error } = await supabase.from("stock").select("*");
    if (!error && data) {
      setStock(data as StockRow[]);
      groupData(data as StockRow[]);
    }
  }

  // Raggruppa per articolo+colore → taglie in orizzontale
  function groupData(data: StockRow[]) {
    const groups: any = {};
    data.forEach((r) => {
      const key = r.articolo + "___" + r.colore;
      if (!groups[key]) {
        groups[key] = { articolo: r.articolo, colore: r.colore, prezzo: r.prezzo, taglie: {} };
      }
      groups[key].taglie[r.taglia] = r.qty;
    });
    setGrouped(Object.values(groups));
  }

  // Aggiungi al carrello
  function addToCart(group: any, selezioni: Record<string, number>) {
    const nuove: OrderLine[] = [];
    Object.entries(selezioni).forEach(([taglia, qty]) => {
      if (qty > 0) {
        const sku = group.articolo + "-" + group.colore + "-" + taglia;
        nuove.push({
          sku,
          articolo: group.articolo,
          taglia,
          colore: group.colore,
          richiesti: qty as number,
          prezzo: group.prezzo,
        });
      }
    });
    setCarrello([...carrello, ...nuove]);
  }

  // Totali
  const totaleLordo = carrello.reduce((acc, r) => acc + r.richiesti * r.prezzo, 0);
  const totaleNetto = totaleLordo - (totaleLordo * sconto) / 100;

  // Conferma ordini (MAGAZZINO)
  async function confermaOrdine() {
    for (const r of carrello) {
      await supabase.rpc("conferma_ordine", {
        p_sku: r.sku,
        p_qty: r.richiesti,
      });
    }
    setCarrello([]);
    await loadStock();
  }

  return (
    <div className="p-4 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">MARS3LO</h1>
          <input
            type="text"
            placeholder="Nome cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className="border p-1 rounded"
          />
        </div>
        <div>
          {!isMagazzino ? (
            <button
              className="bg-gray-800 text-white px-3 py-1 rounded"
              onClick={() => {
                const entered = prompt("Inserisci PIN magazzino");
                if (entered === "1234") setIsMagazzino(true);
                else alert("PIN errato");
              }}
            >
              Modalità MAGAZZINO
            </button>
          ) : (
            <button
              className="bg-red-600 text-white px-3 py-1 rounded"
              onClick={() => setIsMagazzino(false)}
            >
              Esci Magazzino
            </button>
          )}
        </div>
      </div>

      {/* Griglia taglie */}
      <div className="space-y-6">
        {grouped.map((g: any) => {
          const selezioni: Record<string, number> = {};
          return (
            <div key={g.articolo + g.colore} className="border p-3 rounded shadow">
              <div className="flex justify-between items-center mb-2">
                <div className="font-bold text-lg">
                  {g.articolo} <span className="font-normal">({g.colore})</span>
                </div>
                <div className="text-sm">€ {g.prezzo.toFixed(2)}</div>
              </div>
              <div className="flex gap-2">
                {Object.entries(g.taglie).map(([taglia, disp]: any) => (
                  <div key={taglia} className="flex flex-col items-center border rounded p-2 w-16">
                    <div className="font-bold">{taglia}</div>
                    <div className="text-sm text-gray-500">{disp} disp.</div>
                    <input
                      type="number"
                      min={0}
                      max={disp as number}
                      className="w-12 border rounded text-center"
                      onChange={(e) => {
                        selezioni[taglia] = Number(e.target.value);
                      }}
                    />
                  </div>
                ))}
              </div>
              <button
                className="mt-2 bg-blue-600 text-white px-3 py-1 rounded"
                onClick={() => addToCart(g, selezioni)}
              >
                Aggiungi al carrello
              </button>
            </div>
          );
        })}
      </div>

      {/* Carrello */}
      <div className="mt-6 border-t pt-4">
        <h2 className="text-xl font-bold mb-2">Carrello</h2>
        {carrello.length === 0 && <div>Nessun articolo</div>}
        {carrello.length > 0 && (
          <table className="w-full text-sm mb-2">
            <thead>
              <tr className="border-b">
                <th className="text-left">Articolo</th>
                <th>Taglia</th>
                <th>Colore</th>
                <th>Qty</th>
                <th>Prezzo</th>
                <th>Totale</th>
              </tr>
            </thead>
            <tbody>
              {carrello.map((r, i) => (
                <tr key={i} className="border-b">
                  <td>{r.articolo}</td>
                  <td>{r.taglia}</td>
                  <td>{r.colore}</td>
                  <td>{r.richiesti}</td>
                  <td>€ {r.prezzo.toFixed(2)}</td>
                  <td>€ {(r.richiesti * r.prezzo).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-center gap-4 mb-2">
          <div>Totale lordo: € {totaleLordo.toFixed(2)}</div>
          <div>
            Sconto %:{" "}
            <input
              type="number"
              value={sconto}
              onChange={(e) => setSconto(Number(e.target.value))}
              className="w-16 border rounded text-center"
            />
          </div>
          <div className="font-bold">Totale: € {totaleNetto.toFixed(2)}</div>
        </div>

        {isMagazzino && carrello.length > 0 && (
          <button
            className="bg-green-600 text-white px-3 py-1 rounded"
            onClick={confermaOrdine}
          >
            Conferma Ordine (MAGAZZINO)
          </button>
        )}
      </div>
    </div>
  );
}
