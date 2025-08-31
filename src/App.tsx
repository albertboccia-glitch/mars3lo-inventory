import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// 🔑 Config Supabase dalle ENV
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// 📌 Tipi
type Role = "login" | "showroom" | "magazzino";

interface StockItem {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
}

interface OrderLine {
  sku: string;
  articolo: string;
  taglia: string;
  colore: string;
  richiesti: number;
  prezzo: number;
}

// 📌 Login Screen
function LoginScreen({ onLogin }: { onLogin: (id: string, pw: string) => void }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="bg-gray-900 p-8 rounded-lg shadow-lg w-96 text-center">
        <img
          src="/public/mars3lo.png"
          alt="Mars3lo"
          className="mx-auto mb-4 h-20"
        />
        <h2 className="text-white text-xl mb-6">Accedi</h2>
        <input
          placeholder="ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="mb-3 w-full p-2 rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="mb-3 w-full p-2 rounded"
        />
        <button
          onClick={() => onLogin(id, pw)}
          className="bg-white px-4 py-2 rounded text-black font-bold w-full"
        >
          Login
        </button>
      </div>
    </div>
  );
}

// 📌 App principale
export default function App() {
  const [role, setRole] = useState<Role>("login");
  const [stock, setStock] = useState<StockItem[]>([]);
  const [order, setOrder] = useState<OrderLine[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);

  // 🔍 Debug
  useEffect(() => {
    console.log("Ruolo attuale:", role);
  }, [role]);

  // 📌 Login check
  const handleLogin = (id: string, pw: string) => {
    if (id === "Mars3loBo" && pw === "Francesco01") {
      setRole("showroom");
    } else if (id === "Mars3loNa" && pw === "Gbesse01") {
      setRole("magazzino");
    } else {
      alert("Credenziali non valide");
    }
  };

  // 📌 MOCK dati stock (poi arriva da Supabase)
  useEffect(() => {
    setStock([
      {
        sku: "G23250-46-BLU",
        articolo: "G23250 GIACCA",
        categoria: "GIACCHE",
        taglia: "46",
        colore: "BLU",
        qty: 10,
        prezzo: 120,
      },
      {
        sku: "G23250-48-BLU",
        articolo: "G23250 GIACCA",
        categoria: "GIACCHE",
        taglia: "48",
        colore: "BLU",
        qty: 5,
        prezzo: 120,
      },
    ]);
  }, []);

  // 📌 Funzioni ordini
  const aggiungiRiga = (item: StockItem, qty: number) => {
    if (qty <= 0) return;
    setOrder((prev) => [
      ...prev.filter((o) => o.sku !== item.sku),
      {
        sku: item.sku,
        articolo: item.articolo,
        taglia: item.taglia,
        colore: item.colore,
        richiesti: qty,
        prezzo: item.prezzo,
      },
    ]);
  };

  const svuotaOrdine = () => setOrder([]);

  // 📌 Showroom UI
  if (role === "showroom") {
    const totale = order.reduce((sum, o) => sum + o.richiesti * o.prezzo, 0);
    const totaleScontato = totale * (1 - sconto / 100);

    return (
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Showroom Centergross</h1>
          <div>
            Cliente:{" "}
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="border p-1 mr-2"
            />
            Sconto:{" "}
            <input
              type="number"
              value={sconto}
              onChange={(e) => setSconto(Number(e.target.value))}
              className="border p-1 w-16"
            />{" "}
            %
          </div>
        </div>

        <table className="w-full border mb-4">
          <thead>
            <tr className="bg-gray-200">
              <th>Articolo</th>
              <th>Taglia</th>
              <th>Colore</th>
              <th>Disponibili</th>
              <th>Prezzo</th>
              <th>Ordina</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s) => (
              <tr key={s.sku} className="border-b">
                <td>{s.articolo}</td>
                <td>{s.taglia}</td>
                <td>{s.colore}</td>
                <td>{s.qty}</td>
                <td>€{s.prezzo}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={s.qty}
                    className="w-16 border"
                    onChange={(e) =>
                      aggiungiRiga(s, parseInt(e.target.value) || 0)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-lg font-bold mb-2">Ordine</h2>
        <table className="w-full border mb-4">
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
            {order.map((o) => (
              <tr key={o.sku} className="border-b">
                <td>{o.articolo}</td>
                <td>{o.taglia}</td>
                <td>{o.colore}</td>
                <td>{o.richiesti}</td>
                <td>€{o.prezzo}</td>
                <td>€{o.richiesti * o.prezzo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="font-bold">
          Totale: €{totale} <br />
          Totale scontato: €{totaleScontato}
        </div>
        <button
          onClick={svuotaOrdine}
          className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
        >
          Svuota Ordine
        </button>
      </div>
    );
  }

  // 📌 Magazzino UI
  if (role === "magazzino") {
    return (
      <div>
        <div className="bg-black text-white p-4 flex justify-center items-center">
          <img src="/public/mars3lo.png" alt="logo" className="h-10 mr-4" />
          <span className="font-bold text-xl">MARS3LO B2B</span>
        </div>
        <div className="p-4">
          <h1 className="text-xl font-bold mb-4">MAGAZZINO Napoli</h1>
          <p>Qui vedrai gli ordini in arrivo dallo showroom (da collegare a Supabase).</p>
        </div>
      </div>
    );
  }

  // 📌 Login di default
  if (role === "login") {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // 📌 Fallback
  return (
    <div className="p-10 text-center text-red-600">
      Errore: ruolo sconosciuto ({role})
    </div>
  );
}
