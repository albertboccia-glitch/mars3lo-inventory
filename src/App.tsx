import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface Stock {
  sku: string;
  articolo: string;
  categoria: string;
  taglia: string;
  colore: string;
  qty: number;
  prezzo: number;
}
interface CartLine extends Stock {
  qtyOrd: number;
}
interface Order {
  id: string;
  customer: string;
  stato: string;
  created_at: string;
}
interface OrderLine {
  id: number;
  order_id: string;
  sku: string;
  articolo: string;
  taglia: string;
  colore: string;
  richiesti: number;
  confermati: number;
  prezzo: number;
}

// --- Helpers ---
function classify(sku: string): string {
  const up = sku.toUpperCase();
  if (/^GB\d+/.test(up)) return "Giubbotti";
  if (/^G\d+/.test(up)) return "Giacche";
  if (/^P\d+/.test(up)) return "Pantaloni";
  if (/^M\d+/.test(up)) return "Maglie";
  return "Altro";
}
function formatCurrency(v: number) {
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
function uuid() {
  return Math.random().toString(36).substring(2, 10);
}

// --- Component ---
export default function App() {
  const [role, setRole] = useState<"showroom" | "magazzino" | null>(null);
  const [logged, setLogged] = useState(false);

  const [stock, setStock] = useState<Stock[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [newOrderBadge, setNewOrderBadge] = useState(false);

  // --- Load data ---
  useEffect(() => {
    if (logged) {
      loadStock();
      if (role === "magazzino") loadOrders();
      subscribeRealtime();
    }
  }, [logged]);

  async function loadStock() {
    const { data } = await supabase.from("stock").select("*");
    if (data) setStock(data as Stock[]);
  }
  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOrders(data as Order[]);
  }
  async function loadOrderLines(orderId: string) {
    const { data } = await supabase
      .from("order_lines")
      .select("*")
      .eq("order_id", orderId);
    if (data) setOrderLines(data as OrderLine[]);
  }

  function subscribeRealtime() {
    supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (role === "magazzino") {
          setNewOrderBadge(true);
          loadOrders();
        }
        if (role === "showroom") loadOrders();
      })
      .subscribe();
  }

  // --- Cart ---
  function addGroup(group: Stock[], inputs: Record<string, number>) {
    const newLines: CartLine[] = group
      .filter((g) => inputs[g.taglia] && inputs[g.taglia] > 0)
      .map((g) => ({ ...g, qtyOrd: inputs[g.taglia] }));
    const rest = cart.filter(
      (c) => !(c.articolo === group[0].articolo && c.colore === group[0].colore)
    );
    setCart([...rest, ...newLines]);
  }
  function clearGroup(group: Stock[]) {
    const rest = cart.filter(
      (c) => !(c.articolo === group[0].articolo && c.colore === group[0].colore)
    );
    setCart(rest);
  }
  function clearAll() {
    setCart([]);
  }

  // --- Orders ---
  async function sendOrder() {
    if (!customer || cart.length === 0) return;
    const id = uuid();
    await supabase.from("orders").insert({ id, customer, stato: "In attesa" });
    const lines = cart.map((c) => ({
      order_id: id,
      sku: c.sku,
      articolo: c.articolo,
      taglia: c.taglia,
      colore: c.colore,
      richiesti: c.qtyOrd,
      confermati: 0,
      prezzo: c.prezzo,
    }));
    await supabase.from("order_lines").insert(lines);
    setCart([]);
    alert("Ordine inviato");
  }
  async function confirmOrder(order: Order, confirms: Record<number, number>) {
    for (const [id, qty] of Object.entries(confirms)) {
      await supabase.from("order_lines").update({ confermati: qty }).eq("id", id);
    }
    await supabase.from("orders").update({ stato: "Confermato" }).eq("id", order.id);
    loadOrders();
    alert("Ordine confermato");
  }
  async function cancelOrder(order: Order) {
    await supabase.from("orders").delete().eq("id", order.id);
    await supabase.from("order_lines").delete().eq("order_id", order.id);
    loadOrders();
    alert("Ordine annullato");
  }

  // --- Export ---
  function exportCSV() {
    const rows = cart.map((c) => ({
      Cliente: customer,
      Articolo: c.articolo,
      Colore: c.colore,
      Taglia: c.taglia,
      Qta: c.qtyOrd,
      Prezzo: c.prezzo,
      Totale: c.qtyOrd * c.prezzo,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    const buf = XLSX.write(wb, { type: "array", bookType: "csv" });
    saveAs(new Blob([buf], { type: "text/csv" }), "ordine.csv");
  }
  function exportExcel() {
    const rows = cart.map((c) => ({
      Cliente: customer,
      Articolo: c.articolo,
      Colore: c.colore,
      Taglia: c.taglia,
      Qta: c.qtyOrd,
      Prezzo: c.prezzo,
      Totale: c.qtyOrd * c.prezzo,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordine");
    XLSX.writeFile(wb, "ordine.xlsx");
  }
  function exportPDF() {
    const doc = new jsPDF();
    doc.text(`Ordine Cliente: ${customer}`, 10, 10);
    autoTable(doc, {
      head: [["Articolo", "Colore", "Taglia", "Qta", "Prezzo", "Totale"]],
      body: cart.map((c) => [
        c.articolo,
        c.colore,
        c.taglia,
        c.qtyOrd,
        formatCurrency(c.prezzo),
        formatCurrency(c.qtyOrd * c.prezzo),
      ]),
    });
    doc.save("ordine.pdf");
  }

  // --- UI ---
  if (!logged) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
        <img src="/public/mars3lo.png" alt="Mars3lo" className="h-20 mb-6" />
        <div className="bg-gray-900 p-6 rounded-xl w-80">
          <h2 className="text-xl mb-4 text-center">Login</h2>
          <LoginForm setRole={setRole} setLogged={setLogged} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <img src="/public/mars3lo.png" alt="Mars3lo" className="h-12" />
        {role === "magazzino" && newOrderBadge && (
          <span className="bg-red-600 text-white px-3 py-1 rounded-full">🔔 Nuovo ordine!</span>
        )}
      </header>

      {role === "showroom" && (
        <ShowroomUI
          stock={stock}
          cart={cart}
          customer={customer}
          discount={discount}
          setCustomer={setCustomer}
          setDiscount={setDiscount}
          addGroup={addGroup}
          clearGroup={clearGroup}
          clearAll={clearAll}
          sendOrder={sendOrder}
          exportCSV={exportCSV}
          exportExcel={exportExcel}
          exportPDF={exportPDF}
          search={search}
          setSearch={setSearch}
          filterCat={filterCat}
          setFilterCat={setFilterCat}
        />
      )}

      {role === "magazzino" && (
        <MagazzinoUI
          orders={orders}
          orderLines={orderLines}
          loadOrderLines={loadOrderLines}
          confirmOrder={confirmOrder}
          cancelOrder={cancelOrder}
        />
      )}
    </div>
  );
}

// --- LoginForm ---
function LoginForm({ setRole, setLogged }: any) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  function submit() {
    if (id === "Mars3loBo" && pw === "Francesco01") {
      setRole("showroom");
      setLogged(true);
    } else if (id === "Mars3loNa" && pw === "Gbesse01") {
      setRole("magazzino");
      setLogged(true);
    } else {
      alert("Credenziali errate");
    }
  }
  return (
    <div>
      <input value={id} onChange={(e) => setId(e.target.value)} placeholder="ID" className="w-full mb-2 p-2" />
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className="w-full mb-2 p-2" />
      <button onClick={submit} className="w-full bg-blue-600 text-white py-2 rounded">Entra</button>
    </div>
  );
}

// --- ShowroomUI ---
function ShowroomUI({ stock, cart, customer, discount, setCustomer, setDiscount, addGroup, clearGroup, clearAll, sendOrder, exportCSV, exportExcel, exportPDF, search, setSearch, filterCat, setFilterCat }: any) {
  const grouped = groupByArticle(stock);
  const cats = ["", "Giacche", "Giubbotti", "Maglie", "Pantaloni"];

  return (
    <div>
      <div className="mb-4 flex space-x-2">
        <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nome cliente" className="border p-2" />
        <input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value))} placeholder="Sconto %" className="border p-2 w-24" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca codice" className="border p-2 flex-1" />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="border p-2">
          {cats.map((c) => (
            <option key={c}>{c || "Tutte"}</option>
          ))}
        </select>
      </div>

      {Object.entries(grouped)
        .filter(([k]) => !search || k.toLowerCase().includes(search.toLowerCase()))
        .map(([key, group]) => {
          const categoria = classify(group[0].sku);
          if (filterCat && categoria !== filterCat) return null;
          const inputs: Record<string, number> = {};
          return (
            <div key={key} className="border rounded p-2 mb-3">
              <div className="font-bold">{group[0].articolo} {categoria} - <span className="font-bold">{group[0].colore}</span> ({formatCurrency(group[0].prezzo)})</div>
              <div className="flex space-x-2 mt-2">
                {group.map((s) => (
                  <div key={s.taglia} className="text-center">
                    <div>{s.taglia}</div>
                    <div className="text-sm text-gray-600">Disp:{s.qty}</div>
                    <input type="number" min={0} max={s.qty} defaultValue={0} onChange={(e) => (inputs[s.taglia] = parseInt(e.target.value))} className="w-16 border p-1" />
                  </div>
                ))}
                <div className="flex flex-col justify-end">
                  <button onClick={() => addGroup(group, inputs)} className="bg-green-600 text-white px-3 py-1 rounded mb-1">Aggiungi</button>
                  <button onClick={() => clearGroup(group)} className="bg-gray-500 text-white px-3 py-1 rounded">Svuota</button>
                </div>
              </div>
            </div>
          );
        })}

      <div className="mt-6 border-t pt-4">
        <h2 className="font-bold mb-2">Carrello</h2>
        {cart.map((c, i) => (
          <div key={i} className="flex justify-between border-b py-1">
            <span>{c.articolo} {c.colore} {c.taglia} x {c.qtyOrd}</span>
            <span>{formatCurrency(c.prezzo * c.qtyOrd)}</span>
          </div>
        ))}
        <div className="mt-2">
          Totale: {formatCurrency(cart.reduce((t, c) => t + c.qtyOrd * c.prezzo, 0))}
          <br />
          Sconto: {discount}%  
          <br />
          Imponibile: {formatCurrency(cart.reduce((t, c) => t + c.qtyOrd * c.prezzo, 0) * (1 - discount / 100))}
        </div>
        <div className="mt-2 flex space-x-2">
          <button onClick={sendOrder} className="bg-blue-600 text-white px-3 py-1 rounded">Invia ordine</button>
          <button onClick={clearAll} className="bg-gray-500 text-white px-3 py-1 rounded">Svuota tutto</button>
          <button onClick={exportCSV} className="bg-yellow-600 text-white px-3 py-1 rounded">CSV</button>
          <button onClick={exportExcel} className="bg-yellow-600 text-white px-3 py-1 rounded">Excel</button>
          <button onClick={exportPDF} className="bg-red-600 text-white px-3 py-1 rounded">PDF</button>
        </div>
      </div>
    </div>
  );
}

// --- MagazzinoUI ---
function MagazzinoUI({ orders, orderLines, loadOrderLines, confirmOrder, cancelOrder }: any) {
  const [confirms, setConfirms] = useState<Record<number, number>>({});
  return (
    <div className="flex">
      <div className="w-1/3 border-r pr-2">
        <h2 className="font-bold mb-2">Ordini</h2>
        {orders.map((o: Order) => (
          <div key={o.id} className="border p-2 mb-2">
            <div>Cliente: {o.customer}</div>
            <div>Stato: {o.stato}</div>
            <button onClick={() => loadOrderLines(o.id)} className="bg-blue-600 text-white px-2 py-1 mt-1 rounded">Dettagli</button>
            <button onClick={() => cancelOrder(o)} className="bg-red-600 text-white px-2 py-1 mt-1 rounded ml-2">Annulla</button>
          </div>
        ))}
      </div>
      <div className="w-2/3 pl-2">
        <h2 className="font-bold mb-2">Dettaglio ordine</h2>
        {orderLines.map((l: OrderLine) => (
          <div key={l.id} className="flex justify-between border-b py-1">
            <span>{l.articolo} {l.colore} {l.taglia} - richiesti {l.richiesti}</span>
            <input type="number" defaultValue={l.richiesti} onChange={(e) => setConfirms({ ...confirms, [l.id]: parseInt(e.target.value) })} className="w-20 border p-1" />
          </div>
        ))}
        {orderLines.length > 0 && (
          <button onClick={() => confirmOrder({ id: orderLines[0].order_id }, confirms)} className="bg-green-600 text-white px-3 py-1 mt-2 rounded">Conferma</button>
        )}
      </div>
    </div>
  );
}

// --- Grouping helper ---
function groupByArticle(stock: Stock[]) {
  return stock.reduce((acc: any, s) => {
    const key = s.articolo + "-" + s.colore;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
}
