import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Ruoli e credenziali fisse
const CREDENTIALS = {
  showroom: { id: "Mars3loBo", password: "Francesco01" },
  magazzino: { id: "Mars3loNa", password: "Gbesse01" },
};

type StockItem = {
  sku: string;
  articolo: string;
  categoria: string;
  colore: string;
  taglia: string;
  qty: number;
  prezzo: number;
};

type CarrelloItem = StockItem & { ordina: number };

// 🔹 Categoria in base al codice
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

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<"showroom" | "magazzino" | null>(null);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");

  const [stock, setStock] = useState<StockItem[]>([]);
  const [carrello, setCarrello] = useState<CarrelloItem[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState("TUTTI");

  // Login
  const handleLogin = () => {
    if (id === CREDENTIALS.showroom.id && password === CREDENTIALS.showroom.password) {
      setRole("showroom");
      setLoggedIn(true);
    } else if (id === CREDENTIALS.magazzino.id && password === CREDENTIALS.magazzino.password) {
      setRole("magazzino");
      setLoggedIn(true);
    } else {
      alert("Credenziali errate");
    }
  };

  // Carica stock da Supabase
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("stock").select("*");
      if (!error && data) {
        const mapped: StockItem[] = data.map((r: any) => ({
          ...r,
          prezzo: Number(r.prezzo),
          qty: Number(r.qty),
          categoria: getCategoria(r.articolo),
        }));
        setStock(mapped);
      }
    };
    if (loggedIn) load();
  }, [loggedIn]);

  const handleOrdinaChange = (sku: string, value: number) => {
    setCarrello((prev) => {
      const esiste = prev.find((c) => c.sku === sku);
      if (esiste) {
        return prev.map((c) => (c.sku === sku ? { ...c, ordina: value } : c));
      } else {
        const item = stock.find((s) => s.sku === sku);
        if (!item) return prev;
        return [...prev, { ...item, ordina: value }];
      }
    });
  };

  const handleAggiungi = (item: StockItem) => {
    if (item.qty <= 0) return;
    setCarrello((prev) => {
      const esiste = prev.find((c) => c.sku === item.sku);
      if (esiste) {
        return prev.map((c) =>
          c.sku === item.sku ? { ...c, ordina: c.ordina + 1 } : c
        );
      }
      return [...prev, { ...item, ordina: 1 }];
    });
  };

  const handleSvuota = (sku: string) => {
    setCarrello((prev) => prev.filter((c) => c.sku !== sku));
  };

  const totale = carrello.reduce(
    (sum, c) => sum + c.ordina * c.prezzo,
    0
  );

  // ---- Login page ----
  if (!loggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
        <img src="/mars3lo.png" alt="Mars3lo" className="w-48 mb-6" />
        <h1 className="text-3xl font-bold mb-4">Mars3lo B2B</h1>
        <input
          placeholder="ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="mb-2 p-2 rounded text-black"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-2 p-2 rounded text-black"
        />
        <button
          onClick={handleLogin}
          className="bg-white text-black px-4 py-2 rounded font-bold"
        >
          Login
        </button>
      </div>
    );
  }

  // ---- Main page ----
  return (
    <div className="p-4">
      {/* Barra logo */}
      <div className="bg-black flex flex-col items-center py-2 mb-4">
        <img src="/mars3lo.png" alt="Mars3lo" className="h-12 mb-1" />
        <span className="text-white font-bold">MARS3LO B2B</span>
      </div>

      <h2 className="text-xl font-bold mb-4">
        {role === "showroom" ? "Showroom Centergross" : "MAGAZZINO Napoli"}
      </h2>

      {/* 🔹 Filtro categorie */}
      <div className="mb-4">
        <label className="mr-2">Categoria:</label>
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="border px-2 py-1"
        >
          <option value="TUTTI">Tutti</option>
          <option value="GIACCHE">Giacche</option>
          <option value="GIUBBOTTI">Giubbotti</option>
          <option value="MAGLIE">Maglie</option>
          <option value="PANTALONI">Pantaloni</option>
          <option value="PANTALONI FELPA">Pantaloni Felpa</option>
          <option value="CAMICIE">Camicie</option>
          <option value="CAPPOTTI">Cappotti</option>
          <option value="ALTRO">Altro</option>
        </select>
      </div>

      {/* Stock griglia/lista */}
      <table className="w-full border mb-4 text-sm">
        <thead>
          <tr className="bg-gray-200">
            <th>Articolo</th>
            <th>Taglia</th>
            <th>Colore</th>
            <th>Disponibili</th>
            <th>Prezzo</th>
            {role === "showroom" && <th>Ordina</th>}
          </tr>
        </thead>
        <tbody>
          {stock
            .filter(
              (s) => categoriaFiltro === "TUTTI" || s.categoria === categoriaFiltro
            )
            .map((item) => (
              <tr key={item.sku} className="border-b">
                <td>{item.articolo}</td>
                <td>{item.taglia}</td>
                <td>{item.colore}</td>
                <td>{item.qty}</td>
                <td>€{item.prezzo.toFixed(2)}</td>
                {role === "showroom" && (
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={item.qty}
                      value={
                        carrello.find((c) => c.sku === item.sku)?.ordina || 0
                      }
                      onChange={(e) =>
                        handleOrdinaChange(item.sku, Number(e.target.value))
                      }
                      className="w-16 border"
                    />
                    <button
                      onClick={() => handleAggiungi(item)}
                      className="ml-2 bg-blue-500 text-white px-2 rounded"
                    >
                      Aggiungi
                    </button>
                    <button
                      onClick={() => handleSvuota(item.sku)}
                      className="ml-2 bg-red-500 text-white px-2 rounded"
                    >
                      Svuota
                    </button>
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </table>

      {/* Carrello */}
      {role === "showroom" && (
        <div>
          <h3 className="text-lg font-bold mb-2">Ordine</h3>
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-200">
                <th>Articolo</th>
                <th>Taglia</th>
                <th>Colore</th>
                <th>Q.tà</th>
                <th>Prezzo</th>
                <th>Totale</th>
              </tr>
            </thead>
            <tbody>
              {carrello.map((c) => (
                <tr key={c.sku} className="border-b">
                  <td>{c.articolo}</td>
                  <td>{c.taglia}</td>
                  <td>{c.colore}</td>
                  <td>{c.ordina}</td>
                  <td>€{c.prezzo.toFixed(2)}</td>
                  <td>€{(c.ordina * c.prezzo).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="font-bold mt-2">Totale: €{totale.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
