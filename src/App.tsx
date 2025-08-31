import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---- Utility categorie ----
function getCategoria(codice: string): string {
  const c = codice.toUpperCase();
  if (c.startsWith("GB")) return "GIUBBOTTO";
  if (c.startsWith("MG")) return "MAGLIA";
  if (c.startsWith("PM")) return "PANTALONI FELPA";
  if (c.startsWith("G")) return "GIACCA";
  if (c.startsWith("P")) return "PANTALONE";
  if (c.startsWith("C")) return "CAMICIA";
  return "ALTRO";
}

// ---- Tipi ----
interface StockItem {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
}

interface CarrelloRiga {
  sku: string;
  articolo: string;
  taglia: string;
  colore: string;
  prezzo: number;
  qty: number;
}

interface Ordine {
  id: string;
  customer: string;
  stato: string;
  created_at: string;
}

// ---- Login ----
const LoginPage: React.FC<{ onLogin: (role: string) => void }> = ({ onLogin }) => {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (id === "Mars3loBo" && pw === "Francesco01") onLogin("showroom");
    else if (id === "Mars3loNa" && pw === "Gbesse01") onLogin("magazzino");
    else alert("Credenziali non valide");
  }

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center text-white">
      <img src="/public/public/mars3lo.png" alt="Mars3lo Logo" className="h-24 mb-6" />
      <div className="bg-gray-800 p-8 rounded w-80 shadow-lg">
        <h2 className="text-center text-xl mb-4">Login</h2>
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input className="p-2 text-black rounded" placeholder="ID" value={id} onChange={(e) => setId(e.target.value)} />
          <input className="p-2 text-black rounded" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="bg-blue-500 hover:bg-blue-600 p-2 rounded">Entra</button>
        </form>
      </div>
    </div>
  );
};

// ---- Showroom ----
const Showroom: React.FC = () => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [carrello, setCarrello] = useState<CarrelloRiga[]>([]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("ALL");
  const [quantita, setQuantita] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("stock").select("*");
      if (data) setStock(data as StockItem[]);
    })();
  }, []);

  function handleAdd(item: StockItem) {
    const key = item.sku;
    const q = quantita[key] || 0;
    if (q <= 0) return;
    setCarrello((prev) => {
      const existing = prev.find((r) => r.sku === key);
      if (existing) {
        return prev.map((r) => r.sku === key ? { ...r, qty: q } : r);
      } else {
        return [...prev, { sku: item.sku, articolo: item.articolo, taglia: item.taglia, colore: item.colore, prezzo: item.prezzo, qty: q }];
      }
    });
  }

  function handleRemove(sku: string) {
    setCarrello((prev) => prev.filter((r) => r.sku !== sku));
  }

  function handleSvuota() {
    setCarrello([]);
  }

  function totale(): number {
    return carrello.reduce((s, r) => s + r.prezzo * r.qty, 0);
  }

  function totaleScontato(): number {
    return totale() * (1 - sconto / 100);
  }

  async function inviaOrdine() {
    if (!cliente || carrello.length === 0) {
      alert("Inserisci cliente e almeno un articolo");
      return;
    }
    const { data, error } = await supabase.from("orders").insert([{ id: crypto.randomUUID(), customer: cliente, stato: "In attesa" }]).select();
    if (error) {
      alert("Errore ordine: " + error.message);
      return;
    }
    const orderId = data![0].id;
    await supabase.from("order_lines").insert(
      carrello.map((r) => ({
        order_id: orderId,
        sku: r.sku,
        articolo: r.articolo,
        taglia: r.taglia,
        colore: r.colore,
        richiesti: r.qty,
        prezzo: r.prezzo,
      }))
    );
    alert("Ordine inviato!");
    setCarrello([]);
    setCliente("");
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.text(`Ordine Cliente: ${cliente}`, 10, 10);
    const rows = carrello.map((r) => [r.articolo, r.taglia, r.colore, r.qty, r.prezzo, r.prezzo * r.qty]);
    (doc as any).autoTable({ head: [["Articolo", "Taglia", "Colore", "Q.tà", "Prezzo", "Totale"]], body: rows });
    doc.save("ordine.pdf");
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(carrello);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, "ordine.xlsx");
  }

  const filtered = stock.filter((i) =>
    (categoria === "ALL" || i.categoria === categoria) &&
    (i.articolo.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between bg-black text-white p-2 mb-4">
        <img src="/public/public/mars3lo.png" className="h-10" />
        <span className="text-xl font-bold">MARS3LO B2B</span>
      </div>
      <div className="flex gap-4 mb-4">
        <input className="border p-2 flex-1" placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        <div className="flex items-center gap-2">
          <span>Sconto:</span>
          <input type="number" className="border p-2 w-20" value={sconto} onChange={(e) => setSconto(Number(e.target.value))} />
          <span>%</span>
        </div>
      </div>
      <div className="flex gap-4 mb-4">
        <input className="border p-2 flex-1" placeholder="Cerca codice/articolo" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="border p-2">
          <option value="ALL">Tutti</option>
          <option value="GIACCA">Giacche</option>
          <option value="GIUBBOTTO">Giubbotti</option>
          <option value="PANTALONE">Pantaloni</option>
          <option value="MAGLIA">Maglie</option>
          <option value="PANTALONI FELPA">Pantaloni Felpa</option>
          <option value="CAMICIA">Camicie</option>
        </select>
      </div>
      <table className="w-full border mb-4">
        <thead className="bg-gray-200">
          <tr>
            <th>Articolo</th>
            <th>Taglia</th>
            <th>Colore</th>
            <th>Disponibili</th>
            <th>Prezzo</th>
            <th>Ordina</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((i) => (
            <tr key={i.sku} className="border-b">
              <td>{i.articolo} {i.categoria}</td>
              <td>{i.taglia}</td>
              <td className="font-bold">{i.colore}</td>
              <td>{i.qty}</td>
              <td>€{i.prezzo}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={i.qty}
                  className="border p-1 w-16"
                  value={quantita[i.sku] || ""}
                  onChange={(e) => setQuantita({ ...quantita, [i.sku]: Number(e.target.value) })}
                />
              </td>
              <td>
                <button onClick={() => handleAdd(i)} className="bg-green-500 px-2 py-1 rounded text-white mr-2">Aggiungi</button>
                <button onClick={() => handleRemove(i.sku)} className="bg-red-500 px-2 py-1 rounded text-white">Svuota</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="text-xl font-bold mb-2">Ordine</h2>
      <table className="w-full border mb-4">
        <thead className="bg-gray-200">
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
            <tr key={r.sku} className="border-b">
              <td>{r.articolo}</td>
              <td>{r.taglia}</td>
              <td>{r.colore}</td>
              <td>{r.qty}</td>
              <td>€{r.prezzo}</td>
              <td>€{r.prezzo * r.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Totale: €{totale()}</p>
      <p>Totale scontato: €{totaleScontato()}</p>
      <div className="flex gap-2 mt-2">
        <button onClick={inviaOrdine} className="bg-blue-500 px-4 py-2 rounded text-white">Invia Ordine</button>
        <button onClick={handleSvuota} className="bg-red-500 px-4 py-2 rounded text-white">Svuota Ordine</button>
        <button onClick={exportPDF} className="bg-gray-700 px-4 py-2 rounded text-white">PDF</button>
        <button onClick={exportExcel} className="bg-gray-700 px-4 py-2 rounded text-white">Excel</button>
      </div>
    </div>
  );
};

// ---- Magazzino ----
const Magazzino: React.FC = () => {
  const [ordini, setOrdini] = useState<Ordine[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (data) setOrdini(data as Ordine[]);
    })();
  }, []);

  async function confermaOrdine(id: string) {
    await supabase.from("orders").update({ stato: "Confermato" }).eq("id", id);
    setOrdini((prev) => prev.map((o) => o.id === id ? { ...o, stato: "Confermato" } : o));
  }

  async function annullaOrdine(id: string) {
    await supabase.from("orders").update({ stato: "Annullato" }).eq("id", id);
    setOrdini((prev) => prev.map((o) => o.id === id ? { ...o, stato: "Annullato" } : o));
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between bg-black text-white p-2 mb-4">
        <img src="/public/public/mars3lo.png" className="h-10" />
        <span className="text-xl font-bold">MARS3LO B2B - MAGAZZINO</span>
      </div>
      <h2 className="text-xl font-bold mb-4">Ordini ricevuti</h2>
      <table className="w-full border">
        <thead className="bg-gray-200">
          <tr>
            <th>Cliente</th>
            <th>Stato</th>
            <th>Creato</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {ordini.map((o) => (
            <tr key={o.id} className="border-b">
              <td>{o.customer}</td>
              <td>{o.stato}</td>
              <td>{new Date(o.created_at).toLocaleString()}</td>
              <td>
                <button onClick={() => confermaOrdine(o.id)} className="bg-green-500 px-2 py-1 text-white mr-2">Conferma</button>
                <button onClick={() => annullaOrdine(o.id)} className="bg-red-500 px-2 py-1 text-white">Annulla</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---- App ----
const App: React.FC = () => {
  const [role, setRole] = useState<string | null>(null);

  if (!role) return <LoginPage onLogin={setRole} />;
  if (role === "showroom") return <Showroom />;
  if (role === "magazzino") return <Magazzino />;
  return null;
};

export default App;
