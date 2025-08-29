import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase client
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
  const [grouped, setGrouped] = useState<any[]>([]);
  const [carrello, setCarrello] = useState<OrderLine[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);
  const [isMagazzino, setIsMagazzino] = useState(false);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("ALL");

  // Carica stock
  useEffect(() => {
    loadStock();
    const channel = supabase
      .channel("stock-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock" }, () =>
        loadStock()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function loadStock() {
    const { data, error } = await supabase.from("stock").select("*");
    if (!error && data) {
      setStock(data as StockRow[]);
      groupData(data as StockRow[]);
    }
  }

  // Raggruppa per articolo+colore
  function groupData(data: StockRow[]) {
    const groups: Record<string, any> = {};
    data.forEach((r) => {
      const key = r.articolo + "___" + r.colore;
      if (!groups[key]) {
        groups[key] = {
          articolo: r.articolo,
          categoria: r.categoria,
          colore: r.colore,
          prezzo: r.prezzo,
          taglie: {},
        };
      }
      groups[key].taglie[r.taglia] = r.qty;
    });
    setGrouped(Object.values(groups));
  }

  // Aggiungi al carrello
  function addToCart(group: any, selezioni: Record<string, number>) {
    const nuove: OrderLine[] = [];
    Object.entries(selezioni).forEach(([taglia, qty]) => {
      if (qty && qty > 0) {
        const sku = group.articolo + "-" + group.colore + "-" + taglia;
        nuove.push({
          sku,
          articolo: group.articolo,
          taglia,
          colore: group.colore,
          qty,
          prezzo: group.prezzo,
        });
      }
    });
    if (nuove.length > 0) setCarrello([...carrello, ...nuove]);
  }

  // Totali
  const totaleLordo = carrello.reduce((acc, r) => acc + r.qty * r.prezzo, 0);
  const totaleNetto = totaleLordo - (totaleLordo * sconto) / 100;

  // Conferma ordini (MAGAZZINO)
  async function confermaOrdine() {
    for (const r of carrello) {
      await supabase.rpc("conferma_ordine", { p_sku: r.sku, p_qty: r.qty });
    }
    setCarrello([]);
    await loadStock();
  }

  // Filtri applicati
  const visibili = grouped.filter((g: any) => {
    const matchCategoria = categoria === "ALL" || g.categoria === categoria;
    const matchSearch =
      search === "" ||
      g.articolo.toLowerCase().includes(search.toLowerCase()) ||
      g.colore.toLowerCase().includes(search.toLowerCase());
    return matchCategoria && matchSearch;
  });

  // Esporta carrello
  function exportCarrello() {
    const header = "Cliente,Articolo,Taglia,Colore,Qty,Prezzo,Totale\n";
    const rows = carrello
      .map(
        (r) =>
          `${cliente},${r.articolo},${r.taglia},${r.colore},${r.qty},${r.prezzo},${
            r.qty * r.prezzo
          }`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ordine.csv";
    a.click();
  }

  return (
    <div className="p-4 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="logo"
            className="h-10"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
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

      {/* Filtri */}
      <div className="flex gap-2 mb-4">
        {[
          ["ALL", "Tutti"],
          ["G", "Giacche"],
          ["P", "Pantaloni"],
          ["MG", "Maglie"],
          ["GB", "Giubbotti"],
          ["PM", "Felpe"],
          ["C", "Camicie"],
        ].map(([cat, label]) => (
          <button
            key={cat}
            className={`px-3 py-1 rounded ${
              categoria === cat ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setCategoria(cat)}
          >
            {label}
          </button>
        ))}
        <input
          type="text"
          placeholder="Cerca articolo o colore"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-1 rounded flex-1"
        />
      </div>

      {/* Griglia taglie */}
      <div className="space-y-6">
        {visibili.map((g: any) => {
          const selezioni: Record<string, number> = {};
          return (
            <div key={g.articolo + g.colore} className="border p-3 rounded shadow">
              <div className="flex justify-between items-center mb-2">
                <div className="font-bold text-lg">
                  {g.articolo} ({g.categoria}) <span className="font-bold">{g.colore}</span>
                </div>
                <div className="text-sm">€ {g.prezzo.toFixed(2)}</div>
              </div>
              <div className="flex gap-2 overflow-x-auto">
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
          <>
            <table className="w-full text-sm mb-2">
              <thead>
                <tr className="border-b">
                  <th>Articolo</th>
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
                    <td>{r.qty}</td>
                    <td>€ {r.prezzo.toFixed(2)}</td>
                    <td>€ {(r.qty * r.prezzo).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

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

            <div className="flex gap-2">
              <button
                className="bg-gray-400 text-white px-3 py-1 rounded"
                onClick={() => setCarrello([])}
              >
                Svuota carrello
              </button>
              <button
                className="bg-yellow-600 text-white px-3 py-1 rounded"
                onClick={exportCarrello}
              >
                Esporta CSV
              </button>
              {isMagazzino && (
                <button
                  className="bg-green-600 text-white px-3 py-1 rounded"
                  onClick={confermaOrdine}
                >
                  Conferma Ordine (MAGAZZINO)
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
