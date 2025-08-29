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

  // Cari
