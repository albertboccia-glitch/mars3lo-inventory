import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Connessione a Supabase
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
  qty: number;
  prezzo: number;
};

export default function App() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [carrello, setCarrello] = useState<OrderLine[]>([]);
  const [isMagazzino, setIsMagazzino] = useState(false);

  // Carica stock dal DB
  useEffect(() => {
    loadStock();
    const channel = supabase
      .channel("stock-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock" }, () => loadStock())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function loadStock() {
    const { data, error } = await supabase.from("stock").select("*");
    if (!error && data) setStock(data as StockRow[]);
  }

  function addToCart(r: StockRow, qty: number) {
    if (qty > 0) {
      setCarrello([...carrello, { ...r, qty }]);
    }
  }

  async function confermaOrdine() {
    for (const r of carrello) {
      await supabase.rpc("conferma_ordine", { p_sku: r.sku, p_qty: r.qty });
    }
    setCarrello([]);
    await loadStock();
  }

  return (
    <div className="p-4 font-sans">
      <h1 className="text-2xl font-bold mb-4">Mars3lo Inventory</h1>

      {/* Toggle magazzino */}
      {!isMagazzino ? (
        <button
          className="bg-gray-800 text-white px-3 py-1 rounded mb-4"
          onClick={() => {
            const pin = prompt("Inserisci PIN magazzino");
            if (pin === "1234") setIsMagazzino(true);
            else alert("PIN errato");
          }}
        >
          Modalità MAGAZZINO
        </button>
      ) : (
        <button
          className="bg-red-600 text-white px-3 py-1 rounded mb-4"
          onClick={() => setIsMagazzino(false)}
        >
          Esci Magazzino
        </button>
      )}

      {/* Tabella stock */}
      <table className="w-full text-sm border mb-4">
        <thead>
          <tr className="border-b">
            <th>Articolo</th>
            <th>Categoria</th>
            <th>Taglia</th>
            <th>Colore</th>
            <th>Disp.</th>
            <th>Prezzo</th>
            <th>Ordina</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((r) => (
            <tr key={r.sku} className="border-b">
              <td>{r.articolo}</td>
              <td>{r.categoria}</td>
              <td>{r.taglia}</td>
              <td>{r.colore}</td>
              <td>{r.qty}</td>
              <td>€ {r.prezzo}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={r.qty}
                  className="border w-16 text-center"
                  onBlur={(e) => addToCart(r, Number(e.target.value))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Carrello */}
      <h2 className="text-xl font-bold mb-2">Carrello</h2>
      {carrello.length === 0 && <div>Nessun articolo</div>}
      {carrello.length > 0 && (
        <>
          <ul className="mb-2">
            {carrello.map((r, i) => (
              <li key={i}>
                {r.articolo} {r.taglia} {r.colore} x{r.qty} → €
                {(r.qty * r.prezzo).toFixed(2)}
              </li>
            ))}
          </ul>
          {isMagazzino && (
            <button
              className="bg-green-600 text-white px-3 py-1 rounded"
              onClick={confermaOrdine}
            >
              Conferma Ordine (MAGAZZINO)
            </button>
          )}
        </>
      )}
    </div>
  );
}
