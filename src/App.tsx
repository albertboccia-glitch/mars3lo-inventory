import React, { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// Mapping categorie
const categorieMap: Record<string, string> = {
  G: "Giacche",
  P: "Pantaloni",
  MG: "Maglie",
  GB: "Giubbotti",
  PM: "Felpe",
  C: "Camicie",
};

type Item = {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
};

function App() {
  // Stato login
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<"showroom" | "magazzino" | null>(null);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");

  // Stato app
  const [items] = useState<Item[]>([
    // esempio demo
    {
      sku: "G23250-S",
      articolo: "G23250",
      categoria: "G",
      taglia: "S",
      colore: "Blu",
      qty: 10,
      prezzo: 120,
    },
    {
      sku: "G23250-M",
      articolo: "G23250",
      categoria: "G",
      taglia: "M",
      colore: "Blu",
      qty: 5,
      prezzo: 120,
    },
  ]);
  const [cliente, setCliente] = useState("");
  const [sconto, setSconto] = useState(0);
  const [carrello, setCarrello] = useState<Item[]>([]);

  // Login check
  const handleLogin = () => {
    if (id === "Mars3loBo" && password === "Francesco01") {
      setRole("showroom");
      setLoggedIn(true);
    } else if (id === "Mars3loNa" && password === "Gbesse01") {
      setRole("magazzino");
      setLoggedIn(true);
    } else {
      alert("Credenziali errate");
    }
  };

  // Aggiungi al carrello
  const addToCart = (item: Item) => {
    setCarrello([...carrello, { ...item, qty: 1 }]);
  };

  // Totali
  const subtotal = carrello.reduce((acc, it) => acc + it.prezzo * it.qty, 0);
  const totaleScontato = subtotal - (subtotal * sconto) / 100;

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    const logo = new Image();
    logo.src = "/mars3lo.png";
    doc.addImage(logo, "PNG", 10, 10, 30, 20);
    doc.setFontSize(18);
    doc.text("ORDINE CLIENTE", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Cliente: ${cliente}`, 10, 40);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 150, 40);

    autoTable(doc, {
      startY: 50,
      head: [["Codice", "Categoria", "Colore", "Taglia", "Q.tà", "Prezzo €", "Totale €"]],
      body: carrello.map((it) => [
        it.articolo,
        categorieMap[it.categoria] || it.categoria,
        it.colore,
        it.taglia,
        it.qty,
        it.prezzo.toFixed(2),
        (it.prezzo * it.qty).toFixed(2),
      ]),
    });

    doc.text(`Subtotale: € ${subtotal.toFixed(2)}`, 140, doc.lastAutoTable.finalY + 10);
    doc.text(`Sconto: ${sconto}%`, 140, doc.lastAutoTable.finalY + 20);
    doc.text(`Totale: € ${totaleScontato.toFixed(2)}`, 140, doc.lastAutoTable.finalY + 30);

    doc.save(`Ordine_${cliente}.pdf`);
  };

  // Export Excel
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      carrello.map((it) => ({
        Codice: it.articolo,
        Categoria: categorieMap[it.categoria] || it.categoria,
        Colore: it.colore,
        Taglia: it.taglia,
        Quantita: it.qty,
        Prezzo: it.prezzo,
        Totale: it.prezzo * it.qty,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, `Ordine_${cliente}.xlsx`);
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ["Codice", "Categoria", "Colore", "Taglia", "Quantita", "Prezzo", "Totale"];
    const rows = carrello.map(
      (it) =>
        `${it.articolo},${categorieMap[it.categoria] || it.categoria},${it.colore},${it.taglia},${it.qty},${it.prezzo},${
          it.prezzo * it.qty
        }`
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Ordine_${cliente}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- LOGIN PAGE ---
  if (!loggedIn) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center w-80">
          <img src="/mars3lo.png" alt="Mars3lo" className="mx-auto mb-6 h-16" />
          <h1 className="text-xl mb-4">Accesso</h1>
          <input
            type="text"
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="mb-2 w-full p-2 text-black"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full p-2 text-black"
          />
          <button onClick={handleLogin} className="bg-white text-black px-4 py-2 rounded w-full">
            Accedi
          </button>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2">Magazzino Mars3lo</h1>
      <p className="mb-4">Ruolo: {role}</p>

      {/* Cliente e sconto */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Nome Cliente"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          className="border p-2 mr-2"
        />
        <input
          type="number"
          placeholder="Sconto %"
          value={sconto}
          onChange={(e) => setSconto(parseInt(e.target.value))}
          className="border p-2 w-24"
        />
      </div>

      {/* Elenco articoli */}
      <table className="w-full border mb-4">
        <thead>
          <tr className="bg-gray-200">
            <th>Codice</th>
            <th>Categoria</th>
            <th>Colore</th>
            <th>Taglia</th>
            <th>Disponibili</th>
            <th>Prezzo</th>
            <th>Azione</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.sku}>
              <td>{it.articolo}</td>
              <td>{categorieMap[it.categoria] || it.categoria}</td>
              <td>{it.colore}</td>
              <td>{it.taglia}</td>
              <td>{it.qty}</td>
              <td>{it.prezzo} €</td>
              <td>
                <button
                  onClick={() => addToCart(it)}
                  className="bg-blue-500 text-white px-2 py-1 rounded"
                >
                  Aggiungi
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Carrello */}
      <h2 className="text-xl font-bold mb-2">Carrello</h2>
      <table className="w-full border mb-4">
        <thead>
          <tr className="bg-gray-200">
            <th>Codice</th>
            <th>Categoria</th>
            <th>Colore</th>
            <th>Taglia</th>
            <th>Q.tà</th>
            <th>Prezzo</th>
            <th>Totale</th>
          </tr>
        </thead>
        <tbody>
          {carrello.map((it, i) => (
            <tr key={i}>
              <td>{it.articolo}</td>
              <td>{categorieMap[it.categoria] || it.categoria}</td>
              <td>{it.colore}</td>
              <td>{it.taglia}</td>
              <td>{it.qty}</td>
              <td>{it.prezzo} €</td>
              <td>{(it.prezzo * it.qty).toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Subtotale: € {subtotal.toFixed(2)}</p>
      <p>Sconto: {sconto}%</p>
      <p className="font-bold">Totale Imponibile: € {totaleScontato.toFixed(2)}</p>

      {/* Pulsanti export */}
      <div className="mt-4 space-x-2">
        <button onClick={exportPDF} className="bg-red-500 text-white px-3 py-2 rounded">
          Stampa PDF
        </button>
        <button onClick={exportExcel} className="bg-green-500 text-white px-3 py-2 rounded">
          Esporta Excel
        </button>
        <button onClick={exportCSV} className="bg-yellow-500 text-black px-3 py-2 rounded">
          Esporta CSV
        </button>
      </div>

      {/* Azioni magazzino */}
      {role === "magazzino" && (
        <div className="mt-6">
          <button className="bg-purple-500 text-white px-3 py-2 rounded">Conferma Ordini</button>
        </div>
      )}
    </div>
  );
}

export default App;
