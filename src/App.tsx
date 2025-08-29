import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Client Supabase
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

  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("ALL");

  // Carica stock
  useEffect(() => {
    loadStock();
    const channel = supabase
      .channel("stock-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock" },
        () => loadStock()
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
    const groups: any = {};
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

  // Filtri applicati
  const visibili = grouped.filter((g: any) => {
    const matchCategoria = categoria === "ALL" || g.categoria === categoria;
    const matchSearch =
      search === "" ||
      g.articolo.toLowerCase().includes(search.toLowerCase()) ||
      g.colore.toLowerCase().includes(search.toLowerCase());
    return matchCategoria && matchSearch;
  });

  return (
    <div className="p-4 font-sans">
      {/* Header con logo e cliente */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="logo" className="h-10" />
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
        {["ALL", "G", "P", "MG", "GB", "PM", "C"].map((cat) => (
          <button
            key={cat}
            className={`px-3 py-1 rounded ${
              categoria === cat ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setCategoria(cat)}
          >
            {cat === "ALL" ? "Tutti" : cat}
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
                  {g.articolo} {g.categoria && <span>({g.categoria})</span>}{" "}
                  <span className="font-bold">{g.colore}</span>
                </div>
                <div className="text-sm">€ {g.prezzo.toFixed(2)}</div>
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {Object.entries(g.taglie).map(([taglia, disp]: any) => (
                  <div
                    key={taglia}
                    className="flex flex-col items-center border rounded p-2 w-16"
                  >
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
              </butt
