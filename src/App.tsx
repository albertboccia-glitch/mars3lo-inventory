import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

const sortTaglie = (arr: string[]) => {
  const orderLetters = ["XS", "S", "M", "L", "XL", "XXL"];
  return arr.sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);
    if (isNumA && isNumB) return numA - numB;
    if (!isNumA && !isNumB) return orderLetters.indexOf(a) - orderLetters.indexOf(b);
    return isNumA ? -1 : 1;
  });
};

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
  customer: string;
  stato: string;
  created_at: string;
};

type OrderLine = {
  order_id: string;
  sku: string;
  articolo: string;
  taglia: string;
  colore: string;
  richiesti: number;
  confermati: number | null;
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
  const [ruolo, setRuolo] = useState<"bo" | "na" | null>(null);

  const [showNotifiche, setShowNotifiche] = useState(false);
  const [ordini, setOrdini] = useState<Order[]>([]);
  const [ordineSelezionato, setOrdineSelezionato] = useState<Order | null>(null);
  const [lineeOrdine, setLineeOrdine] = useState<OrderLine[]>([]);

  const [ordiniEvasi, setOrdiniEvasi] = useState<Order[]>([]);
  const [ordineBoSelezionato, setOrdineBoSelezionato] = useState<Order | null>(null);
  const [lineeBoOrdine, setLineeBoOrdine] = useState<OrderLine[]>([]);

  // 🔹 Login
  const handleLogin = () => {
    if (loginId === "Mars3loBo" && loginPw === "Francesco01") {
      setRuolo("bo");
      setLogged(true);
    } else if (loginId === "Mars3loNa" && loginPw === "Gbesse01") {
      setRuolo("na");
      setLogged(true);
    } else {
      alert("Credenziali errate");
    }
  };

  // 🔹 Carica stock
  useEffect(() => {
    const fetchStock = async () => {
      let { data } = await supabase.from("stock").select("*");
      if (data) {
        setStock((data as StockRow[]).map((r) => ({ ...r, categoria: getCategoria(r.sku) })));
      }
    };
    fetchStock();
  }, []);

  // 🔹 Carica ordini
  useEffect(() => {
    const fetchOrders = async () => {
      let { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (data) {
        setOrdini(data as Order[]);
        setOrdiniEvasi((data as Order[]).filter((o) => o.stato !== "In attesa"));
      }
    };
    fetchOrders();
  }, [showNotifiche]);

  // 🔹 Apri ordine (Napoli)
  const apriOrdine = async (ordine: Order) => {
    setOrdineSelezionato(ordine);
    let { data } = await supabase.from("order_lines").select("*").eq("order_id", ordine.id);
    if (data) setLineeOrdine(data as OrderLine[]);
  };

  // 🔹 Apri ordine (Bologna)
  const apriBoOrdine = async (ordine: Order) => {
    setOrdineBoSelezionato(ordine);
    let { data } = await supabase.from("order_lines").select("*").eq("order_id", ordine.id);
    if (data) setLineeBoOrdine(data as OrderLine[]);
  };

  // 🔹 Conferma ordine Napoli
  const confermaOrdine = async () => {
    if (!ordineSelezionato) return;
    for (let r of lineeOrdine) {
      await supabase.from("order_lines").update({ confermati: r.confermati }).eq("order_id", r.order_id).eq("sku", r.sku).eq("taglia", r.taglia);
      await supabase.from("stock").update({
        qty: (stock.find((s) => s.sku === r.sku && s.taglia === r.taglia)?.qty || 0) - (r.confermati || 0),
      }).eq("sku", r.sku).eq("taglia", r.taglia);
    }
    let completo = lineeOrdine.every((l) => l.richiesti === l.confermati);
    let annullato = lineeOrdine.every((l) => (l.confermati || 0) === 0);
    let stato = completo ? "Evaso" : annullato ? "Annullato" : "Parziale";
    await supabase.from("orders").update({ stato }).eq("id", ordineSelezionato.id);
    alert("Ordine aggiornato!");
    setOrdineSelezionato(null);
    setLineeOrdine([]);
  };

  // 🔹 Annulla ordine Napoli
  const annullaOrdine = async () => {
    if (!ordineSelezionato) return;
    for (let r of lineeOrdine) {
      await supabase.from("order_lines").update({ confermati: 0 }).eq("order_id", r.order_id).eq("sku", r.sku).eq("taglia", r.taglia);
    }
    await supabase.from("orders").update({ stato: "Annullato" }).eq("id", ordineSelezionato.id);
    alert("Ordine annullato!");
    setOrdineSelezionato(null);
    setLineeOrdine([]);
  };

  // 🔹 Aggiungi al carrello (Bologna)
  const addToCart = (rows: StockRow[], ordini: Record<string, number>) => {
    const nuovi = rows.map((r) => (ordini[r.taglia] ? { ...r, ordina: ordini[r.taglia] } : null)).filter(Boolean) as CarrelloRow[];
    setCarrello((prev) => {
      const senza = prev.filter((p) => !nuovi.find((n) => n.sku === p.sku));
      return [...senza, ...nuovi];
    });
  };

  const svuotaCarrello = () => {
    setCarrello([]);
    setOrdiniInput({});
  };

  const totale = carrello.reduce((sum, r) => sum + r.prezzo * r.ordina, 0);
  const totaleScontato = totale * (1 - sconto / 100);

  const inviaOrdine = async () => {
    if (!cliente) {
      alert("Inserisci il nome cliente");
      return;
    }
    const orderId = Date.now().toString();
    await supabase.from("orders").insert([{ id: orderId, customer: cliente, stato: "In attesa" }]);
    await supabase.from("order_lines").insert(
      carrello.map((r) => ({
        order_id: orderId,
        sku: r.sku,
        articolo: r.articolo,
        taglia: r.taglia,
        colore: r.colore,
        richiesti: r.ordina,
        confermati: null,
        prezzo: r.prezzo,
      }))
    );
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
          <input className="w-full mb-2 p-2 rounded" placeholder="ID" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
          <input type="password" className="w-full mb-4 p-2 rounded" placeholder="Password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} />
          <button onClick={handleLogin} className="bg-red-600 text-white px-4 py-2 rounded w-full">Accedi</button>
        </div>
      </div>
    );
  }

  // 🔹 Napoli UI
  if (ruolo === "na") {
    if (showNotifiche) {
      return (
        <div className="min-h-screen bg-gray-100">
          <div className="bg-black p-4 flex justify-between items-center">
            <h1 className="text-white text-xl font-bold">Mars3lo Napoli – Ordini</h1>
            <button onClick={() => { setShowNotifiche(false); setOrdineSelezionato(null); }} className="bg-gray-600 text-white px-4 py-1 rounded">Magazzino</button>
          </div>
          {!ordineSelezionato ? (
            <div className="p-4">
              <h2 className="font-bold mb-2">Ordini in attesa</h2>
              <table className="w-full border">
                <thead><tr><th>ID</th><th>Cliente</th><th>Stato</th><th>Data</th></tr></thead>
                <tbody>
                  {ordini.filter((o) => o.stato === "In attesa").map((o) => (
                    <tr key={o.id} onClick={() => apriOrdine(o)} className="cursor-pointer hover:bg-gray-100">
                      <td>{o.id}</td><td>{o.customer}</td><td>{o.stato}</td><td>{new Date(o.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <h2 className="font-bold mb-2">Ordine {ordineSelezionato.id} – {ordineSelezionato.customer}</h2>
              {/* griglia articoli */}
              {Object.values(lineeOrdine.reduce((acc: any, r) => {
                const key = r.articolo + "_" + r.colore;
                if (!acc[key]) acc[key] = { ...r, taglie: [] as OrderLine[] };
                acc[key].taglie.push(r);
                return acc;
              }, {})).map((gruppo: any, idx: number) => {
                const rows = sortTaglie(gruppo.taglie.map((t: OrderLine) => t.taglia)).map((taglia) => gruppo.taglie.find((t: OrderLine) => t.taglia === taglia)!);
                return (
                  <div key={idx} className="bg-white shadow rounded-lg p-4 mb-4">
                    <h2 className="font-bold mb-2">{gruppo.sku} {gruppo.articolo} – {gruppo.colore} – €{Number(gruppo.prezzo).toFixed(2)}</h2>
                    <table className="w-full border text-center">
                      <thead>
                        <tr><th>Taglia</th>{rows.map((r) => (<th key={r.taglia}>{r.taglia}</th>))}</tr>
                        <tr><td>Ordina</td>{rows.map((r) => (<td key={r.taglia}>{r.richiesti}</td>))}</tr>
                        <tr><td>Evaso</td>{rows.map((r, i) => (
                          <td key={i}>
                            <input type="number" min={0} max={r.richiesti} value={r.confermati ?? r.richiesti}
                              onChange={(e) => {
                                const v = parseInt(e.target.value) || 0;
                                setLineeOrdine((prev) => prev.map((x) => (x.sku === r.sku && x.taglia === r.taglia ? { ...x, confermati: v } : x)));
                              }}
                              className="w-16 p-1 border rounded text-center"
                            />
                          </td>
                        ))}</tr>
                      </thead>
                    </table>
                  </div>
                );
              })}
              <div className="mt-4 flex gap-2">
                <button onClick={confermaOrdine} className="bg-green-600 text-white px-4 py-2 rounded">Conferma</button>
                <button onClick={annullaOrdine} className="bg-red-600 text-white px-4 py-2 rounded">Annulla</button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Magazzino Napoli
    const groupedStock = stock.reduce((acc: any, row) => {
      const key = row.articolo + "_" + row.colore;
      if (!acc[key]) acc[key] = { ...row, taglie: [] as StockRow[] };
      acc[key].taglie.push(row);
      return acc;
    }, {});

    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-black p-4 flex justify-between items-center">
          <h1 className="text-white text-xl font-bold">Mars3lo Napoli – Magazzino</h1>
          <button onClick={() => setShowNotifiche(true)} className="bg-blue-600 text-white px-4 py-1 rounded">Notifiche Ordini</button>
        </div>
        <div className="p-4 space-y-6">
          {Object.values(groupedStock).map((gruppo: any, idx: number) => {
            const rows = sortTaglie(gruppo.taglie.map((t: StockRow) => t.taglia)).map((taglia) => gruppo.taglie.find((t: StockRow) => t.taglia === taglia)!);
            return (
              <div key={idx} className="bg-white shadow rounded-lg p-4">
                <h2 className="font-bold mb-2">{gruppo.sku} {gruppo.articolo} {gruppo.categoria} – {gruppo.colore} – €{Number(gruppo.prezzo).toFixed(2)}</h2>
                <table className="w-full border text-center">
                  <thead>
                    <tr><th>Taglia</th>{rows.map((r) => (<th key={r.taglia}>{r.taglia}</th>))}</tr>
                    <tr><td>Disp.</td>{rows.map((r) => (<td key={r.taglia}>{r.qty}</td>))}</tr>
                  </thead>
                </table>
              </div>
            );
          })}
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          <button className="bg-gray-600 text-white px-4 py-2 rounded">Esporta CSV</button>
          <button className="bg-gray-600 text-white px-4 py-2 rounded">Esporta Excel</button>
          <button className="bg-red-600 text-white px-4 py-2 rounded">Esporta PDF</button>
        </div>
      </div>
    );
  }

  // 🔹 Bologna UI
  if (ruolo === "bo") {
    const filteredStock = stock.filter((s) => (filtro === "TUTTI" || s.categoria === filtro) && (s.articolo.toLowerCase().includes(ricerca.toLowerCase()) || s.sku.toLowerCase().includes(ricerca.toLowerCase())));
    const grouped = filteredStock.reduce((acc: any, row) => {
      const key = row.articolo + "_" + row.colore;
      if (!acc[key]) acc[key] = { ...row, taglie: [] as StockRow[]
};
acc[key].taglie.push(row);
return acc;
}, {});
    return (
  <div className="min-h-screen bg-gray-100">
    <div className="bg-black p-4 flex justify-between items-center">
      <div className="flex items-center">
        <img src="/mars3lo.png" alt="Mars3lo" className="h-10 mr-4" />
        <h1 className="text-white text-xl font-bold">Mars3lo Bologna</h1>
      </div>
      <button onClick={() => setShowNotifiche(true)} className="bg-blue-600 text-white px-4 py-1 rounded">Ordini Evasi</button>
    </div>

    {showNotifiche ? (
      <div className="p-4">
        {!ordineBoSelezionato ? (
          <>
            <h2 className="font-bold mb-2">Ordini Evasi</h2>
            <table className="w-full border">
              <thead><tr><th>ID</th><th>Cliente</th><th>Stato</th><th>Data</th></tr></thead>
              <tbody>
                {ordiniEvasi.map((o) => (
                  <tr key={o.id} onClick={() => apriBoOrdine(o)} className="cursor-pointer hover:bg-gray-100">
                    <td>{o.id}</td><td>{o.customer}</td><td>{o.stato}</td><td>{new Date(o.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div>
            <h2 className="font-bold mb-2">Ordine {ordineBoSelezionato.id} – {ordineBoSelezionato.customer}</h2>
            {Object.values(lineeBoOrdine.reduce((acc: any, r) => {
              const key = r.articolo + "_" + r.colore;
              if (!acc[key]) acc[key] = { ...r, taglie: [] as OrderLine[] };
              acc[key].taglie.push(r);
              return acc;
            }, {})).map((gruppo: any, idx: number) => {
              const rows = sortTaglie(gruppo.taglie.map((t: OrderLine) => t.taglia)).map((taglia) => gruppo.taglie.find((t: OrderLine) => t.taglia === taglia)!);
              return (
                <div key={idx} className="bg-white shadow rounded-lg p-4 mb-4">
                  <h2 className="font-bold mb-2">{gruppo.sku} {gruppo.articolo} – {gruppo.colore} – €{Number(gruppo.prezzo).toFixed(2)}</h2>
                  <table className="w-full border text-center">
                    <thead>
                      <tr><th>Taglia</th>{rows.map((r) => (<th key={r.taglia}>{r.taglia}</th>))}</tr>
                      <tr><td>Ordina</td>{rows.map((r) => (<td key={r.taglia}>{r.richiesti}</td>))}</tr>
                      <tr><td>Evaso</td>{rows.map((r) => (<td key={r.taglia}>{r.confermati ?? 0}</td>))}</tr>
                    </thead>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    ) : (
      <>
        <div className="p-4 flex gap-4 items-center">
          <input placeholder="Cliente" className="border p-2 rounded flex-1" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <label className="flex items-center gap-2">Sconto:
            <input type="number" className="border p-2 rounded w-20" value={sconto} onChange={(e) => setSconto(parseInt(e.target.value) || 0)} /> %
          </label>
        </div>
        <div className="px-4 mb-4 flex flex-wrap gap-4 items-center">
          <div>
            <label className="mr-2">Categoria:</label>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="border p-2 rounded">
              <option value="TUTTI">Tutti</option>
              <option value="GIACCHE">Giacche</option>
              <option value="PANTALONI">Pantaloni</option>
              <option value="GIUBBOTTI">Giubbotti</option>
              <option value="MAGLIE">Maglie</option>
              <option value="CAPPOTTI">Cappotti</option>
              <option value="CAMICIE">Camicie</option>
            </select>
          </div>
          <input type="text" placeholder="Cerca per codice o articolo..." className="border p-2 rounded flex-1" value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
        </div>
        <div className="p-4 space-y-6">
          {Object.values(grouped).map((gruppo: any) => {
            const rows = sortTaglie(gruppo.taglie.map((t: StockRow) => t.taglia)).map((taglia) => gruppo.taglie.find((t: StockRow) => t.taglia === taglia)!);
            return (
              <div key={gruppo.sku} className="bg-white shadow rounded-lg p-4">
                <h2 className="font-bold mb-2">{gruppo.sku} {gruppo.articolo} {gruppo.categoria} – {gruppo.colore} – €{Number(gruppo.prezzo).toFixed(2)}</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-max border text-center">
                    <thead>
                      <tr><th className="px-2">Taglia</th>{rows.map((r) => (<th key={r.taglia} className="px-2">{r.taglia}</th>))}</tr>
                      <tr><td className="px-2">Disp.</td>{rows.map((r) => (<td key={r.taglia}>{r.qty}</td>))}</tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-2">Ordina</td>
                        {rows.map((r) => (
                          <td key={r.taglia}>
                            <input type="number" min={0} max={r.qty} className="w-16 p-1 border rounded text-center"
                              value={ordiniInput[gruppo.sku]?.[r.taglia] ?? ""}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setOrdiniInput((prev) => ({
                                  ...prev,
                                  [gruppo.sku]: { ...prev[gruppo.sku], [r.taglia]: val },
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
                  <button onClick={() => addToCart(rows, ordiniInput[gruppo.sku] || {})} className="bg-green-600 text-white px-4 py-1 rounded">Aggiungi</button>
                  <button onClick={() => {
                    setCarrello((prev) => prev.filter((p) => !rows.find((r) => r.sku === p.sku)));
                    setOrdiniInput((prev) => { const copia = { ...prev }; delete copia[gruppo.sku]; return copia; });
                  }} className="bg-gray-600 text-white px-4 py-1 rounded">Svuota</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-4 bg-white shadow mt-6">
          <h2 className="font-bold mb-2">Ordine</h2>
          <table className="w-full border">
            <thead><tr><th>Articolo</th><th>Taglia</th><th>Colore</th><th>Q.tà</th><th>Prezzo</th><th>Totale</th></tr></thead>
            <tbody>
              {carrello.map((r) => (
                <tr key={r.sku + r.taglia}>
                  <td>{r.articolo}</td><td>{r.taglia}</td><td>{r.colore}</td><td>{r.ordina}</td>
                  <td>€{r.prezzo.toFixed(2)}</td><td>€{(r.ordina * r.prezzo).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4"><p>Totale: €{totale.toFixed(2)}</p><p>Totale scontato: €{totaleScontato.toFixed(2)}</p></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={inviaOrdine} className="bg-blue-600 text-white px-4 py-2 rounded">Invia Ordine</button>
            <button onClick={svuotaCarrello} className="bg-red-600 text-white px-4 py-2 rounded">Svuota Ordine</button>
            <button className="bg-gray-600 text-white px-4 py-2 rounded">Esporta CSV</button>
            <button className="bg-gray-600 text-white px-4 py-2 rounded">Esporta Excel</button>
            <button className="bg-red-600 text-white px-4 py-2 rounded">Esporta PDF</button>
          </div>
        </div>
      </>
    )}
  </div>
);
}
return null;
}
