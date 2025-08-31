import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

// ✅ Config Supabase (usa variabili d’ambiente su Vercel)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// ✅ Credenziali fisse
const USERS = {
  showroom: { id: "Mars3loBo", pass: "Francesco01", role: "showroom" },
  magazzino: { id: "Mars3loNa", pass: "Gbesse01", role: "magazzino" },
};

export default function App() {
  const [user, setUser] = useState<{ role: string; name: string } | null>(null);
  const [id, setId] = useState("");
  const [pass, setPass] = useState("");
  const [stock, setStock] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);

  // ✅ Login check
  const handleLogin = () => {
    if (id === USERS.showroom.id && pass === USERS.showroom.pass) {
      setUser({ role: "showroom", name: "Showroom Centergross" });
      loadStock();
    } else if (id === USERS.magazzino.id && pass === USERS.magazzino.pass) {
      setUser({ role: "magazzino", name: "MAGAZZINO Napoli" });
      loadStock();
    } else {
      alert("Credenziali errate");
    }
  };

  // ✅ Carica stock da Supabase
  const loadStock = async () => {
    const { data, error } = await supabase.from("stock").select("*");
    if (error) console.error(error);
    else setStock(data || []);
  };

  // ✅ Aggiungi al carrello
  const addToCart = (item: any, qty: number) => {
    if (qty <= 0) return;
    setCart([...cart, { ...item, qty }]);
  };

  // ✅ Esporta CSV
  const exportCSV = () => {
    const rows = cart.map(c => ({
      Cliente: customer,
      Articolo: c.articolo,
      Taglia: c.taglia,
      Colore: c.colore,
      Quantità: c.qty,
      Prezzo: c.prezzo,
      Totale: c.qty * c.prezzo,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, `ordine_${customer}.csv`);
  };

  // ✅ Esporta Excel
  const exportExcel = () => {
    const rows = cart.map(c => ({
      Cliente: customer,
      Articolo: c.articolo,
      Taglia: c.taglia,
      Colore: c.colore,
      Quantità: c.qty,
      Prezzo: c.prezzo,
      Totale: c.qty * c.prezzo,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, `ordine_${customer}.xlsx`);
  };

  // ✅ Stampa PDF tipo fattura
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.addImage("/mars3lo.png", "PNG", 10, 10, 40, 20);
    doc.setFontSize(14);
    doc.text(`Ordine cliente: ${customer}`, 10, 40);
    const rows = cart.map(c => [
      c.articolo,
      c.taglia,
      c.colore,
      c.qty,
      `${c.prezzo} €`,
      `${c.qty * c.prezzo} €`,
    ]);
    doc.autoTable({
      head: [["Articolo", "Taglia", "Colore", "Quantità", "Prezzo", "Totale"]],
      body: rows,
      startY: 50,
    });
    const totale = cart.reduce((sum, c) => sum + c.qty * c.prezzo, 0);
    const scontato = totale * (1 - discount / 100);
    doc.text(`Totale: € ${totale.toFixed(2)}`, 10, doc.lastAutoTable.finalY + 10);
    doc.text(
      `Sconto: ${discount}% → Imponibile: € ${scontato.toFixed(2)}`,
      10,
      doc.lastAutoTable.finalY + 20
    );
    doc.save(`ordine_${customer}.pdf`);
  };

  // ✅ Totali
  const totale = cart.reduce((sum, c) => sum + c.qty * c.prezzo, 0);
  const imponibile = totale * (1 - discount / 100);

  // -------------------- RENDER --------------------
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <img src="/mars3lo.png" alt="Mars3lo" className="w-48 mb-6" />
        <div className="bg-gray-900 p-6 rounded-lg shadow-lg w-80">
          <h1 className="text-xl font-bold text-center mb-4">Accesso</h1>
          <input
            className="w-full mb-2 p-2 text-black"
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
          <input
            className="w-full mb-4 p-2 text-black"
            type="password"
            placeholder="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded"
          >
            Entra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b pb-2 mb-4">
        <img src="/mars3lo.png" alt="Mars3lo" className="w-32" />
        <div>
          <p className="font-bold">{user.name}</p>
          <input
            className="border p-1"
            placeholder="Cliente"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          />
          <input
            type="number"
            className="border p-1 ml-2 w-20"
            placeholder="Sconto %"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
        </div>
      </div>

      {/* LISTA STOCK */}
      <h2 className="text-lg font-bold mb-2">Magazzino</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2">Codice</th>
              <th className="border px-2">Categoria</th>
              <th className="border px-2">Taglia</th>
              <th className="border px-2">Colore</th>
              <th className="border px-2">Disponibili</th>
              <th className="border px-2">Prezzo</th>
              {user.role === "showroom" && <th className="border px-2">Ordina</th>}
            </tr>
          </thead>
          <tbody>
            {stock.map((item) => (
              <tr key={item.sku}>
                <td className="border px-2">{item.sku}</td>
                <td className="border px-2">{item.categoria}</td>
                <td className="border px-2">{item.taglia}</td>
                <td className="border px-2 font-bold">{item.colore}</td>
                <td className="border px-2">{item.qty}</td>
                <td className="border px-2">{item.prezzo} €</td>
                {user.role === "showroom" && (
                  <td className="border px-2">
                    <input
                      type="number"
                      min="0"
                      max={item.qty}
                      className="w-16 border"
                      onChange={(e) => addToCart(item, Number(e.target.value))}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CARRELLO */}
      {cart.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h2 className="text-lg font-bold mb-2">Carrello</h2>
          <ul>
            {cart.map((c, i) => (
              <li key={i}>
                {c.articolo} {c.colore} {c.taglia} x {c.qty} → €{" "}
                {(c.qty * c.prezzo).toFixed(2)}
              </li>
            ))}
          </ul>
          <p className="mt-2 font-bold">Totale: € {totale.toFixed(2)}</p>
          <p>Sconto {discount}% → Imponibile: € {imponibile.toFixed(2)}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={exportCSV} className="bg-gray-600 text-white px-3 py-1 rounded">
              Esporta CSV
            </button>
            <button onClick={exportExcel} className="bg-green-600 text-white px-3 py-1 rounded">
              Esporta Excel
            </button>
            <button onClick={exportPDF} className="bg-red-600 text-white px-3 py-1 rounded">
              Stampa PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
