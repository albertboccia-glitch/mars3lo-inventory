  // --- BLOCCO 1: Bologna ---
  if (role === "BO") {
    // Filtraggio stock
    const filteredStock = stock.filter(
      (s) =>
        (filtro === "TUTTI" || s.categoria === filtro) &&
        (s.articolo.toLowerCase().includes(ricerca.toLowerCase()) ||
          s.sku.toLowerCase().includes(ricerca.toLowerCase()))
    );

    // Raggruppamento articoli
    const grouped = filteredStock.reduce((acc: any, row) => {
      const key = row.articolo + "_" + row.colore;
      if (!acc[key]) acc[key] = { ...row, taglie: [] as StockRow[] };
      acc[key].taglie.push(row);
      return acc;
    }, {});

    // Totali
    const totale = carrello.reduce((sum, r) => sum + r.prezzo * r.ordina, 0);
    const totaleScontato = totale * (1 - sconto / 100);

    return (
      <div className="min-h-screen bg-gray-100">
        {/* Barra nera */}
        <div className="bg-black p-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/mars3lo.png" alt="Mars3lo" className="h-10 mr-4" />
            <h1 className="text-white text-xl font-bold">Mars3lo B2B – Bologna</h1>
          </div>
          <button
            onClick={() => setLogged(false)}
            className="bg-gray-700 text-white px-4 py-2 rounded"
          >
            Torna indietro
          </button>
        </div>

        {/* Cliente + Sconto */}
        <div className="p-4 flex gap-4 items-center">
          <input
            placeholder="Cliente"
            className="border p-2 rounded flex-1"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          />
          <label className="flex items-center gap-2">
            Sconto:
            <input
              type="number"
              className="border p-2 rounded w-20"
              value={sconto}
              onChange={(e) => setSconto(parseInt(e.target.value) || 0)}
            />
            %
          </label>
        </div>

        {/* Filtro categorie + ricerca */}
        <div className="px-4 mb-4 flex flex-wrap gap-4 items-center">
          <div>
            <label className="mr-2">Categoria:</label>
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="TUTTI">Tutti</option>
              <option value="GIACCHE">Giacche</option>
              <option value="PANTALONI">Pantaloni</option>
              <option value="GIUBBOTTI">Giubbotti</option>
              <option value="MAGLIE">Maglie</option>
              <option value="CAPPOTTI">Cappotti</option>
              <option value="CAMICIE">Camicie</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Cerca per codice o articolo..."
            className="border p-2 rounded flex-1"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
        </div>

        {/* Griglia articoli */}
        <div className="p-4 space-y-6">
          {Object.values(grouped).map((gruppo: any) => {
            const rows: StockRow[] = sortTaglie(
              gruppo.taglie.map((t: StockRow) => t.taglia)
            ).map((taglia) =>
              gruppo.taglie.find((t: StockRow) => t.taglia === taglia)!
            );

            return (
              <div key={gruppo.sku} className="bg-white shadow rounded-lg p-4">
                <h2 className="font-bold mb-2">
                  {gruppo.articolo} {gruppo.categoria} – {gruppo.colore} – €
                  {Number(gruppo.prezzo).toFixed(2)}
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-max border text-center">
                    <thead>
                      <tr>
                        <th className="px-2">Taglia</th>
                        {rows.map((r) => (
                          <th key={r.taglia} className="px-2">
                            {r.taglia}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-2">Disp.</td>
                        {rows.map((r) => (
                          <td key={r.taglia}>{r.qty}</td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-2">Ordina</td>
                        {rows.map((r) => (
                          <td key={r.taglia}>
                            <input
                              type="number"
                              min={0}
                              max={r.qty}
                              className="w-16 p-1 border rounded"
                              value={ordiniInput[gruppo.sku]?.[r.taglia] || 0}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setOrdiniInput((prev) => ({
                                  ...prev,
                                  [gruppo.sku]: {
                                    ...prev[gruppo.sku],
                                    [r.taglia]: val,
                                  },
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
                  <button
                    onClick={() =>
                      setCarrello((prev) => {
                        const nuovi = rows
                          .map((r) =>
                            ordiniInput[gruppo.sku]?.[r.taglia]
                              ? {
                                  ...r,
                                  ordina: ordiniInput[gruppo.sku][r.taglia],
                                }
                              : null
                          )
                          .filter(Boolean) as CarrelloRow[];
                        const senza = prev.filter(
                          (p) => !nuovi.find((n) => n.sku === p.sku)
                        );
                        return [...senza, ...nuovi];
                      })
                    }
                    className="bg-green-600 text-white px-4 py-1 rounded"
                  >
                    Aggiungi
                  </button>
                  <button
                    onClick={() => {
                      setCarrello((prev) =>
                        prev.filter((p) => !rows.find((r) => r.sku === p.sku))
                      );
                      setOrdiniInput((prev) => {
                        const copia = { ...prev };
                        delete copia[gruppo.sku];
                        return copia;
                      });
                    }}
                    className="bg-gray-600 text-white px-4 py-1 rounded"
                  >
                    Svuota
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Carrello */}
        <div className="p-4 bg-white shadow mt-6">
          <h2 className="font-bold mb-2">Ordine</h2>
          <table className="w-full border">
            <thead>
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
                <tr key={r.sku + r.taglia}>
                  <td>{r.articolo}</td>
                  <td>{r.taglia}</td>
                  <td>{r.colore}</td>
                  <td>{r.ordina}</td>
                  <td>€{r.prezzo.toFixed(2)}</td>
                  <td>€{(r.ordina * r.prezzo).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4">
            <p>Totale: €{totale.toFixed(2)}</p>
            <p>Totale scontato: €{totaleScontato.toFixed(2)}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="bg-blue-600 text-white px-4 py-2 rounded">
              Invia Ordine
            </button>
            <button className="bg-gray-600 text-white px-4 py-2 rounded">
              Esporta CSV
            </button>
            <button className="bg-gray-600 text-white px-4 py-2 rounded">
              Esporta Excel
            </button>
            <button className="bg-red-600 text-white px-4 py-2 rounded">
              Esporta PDF
            </button>
            <button
              onClick={() => setCarrello([])}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Svuota Ordine
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- BLOCCO 2: Napoli ---
  if (role === "NA") {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Barra nera */}
        <div className="bg-black p-4 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/mars3lo.png" alt="Mars3lo" className="h-10 mr-4" />
            <h1 className="text-white text-xl font-bold">Mars3lo B2B – Napoli</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const { data, error } = await supabase
                  .from("orders")
                  .select("*")
                  .eq("stato", "In attesa")
                  .order("created_at", { ascending: false });
                if (!error && data) {
                  setOrdini(data);
                  setPaginaNapoli("ordini");
                }
              }}
              className="bg-yellow-500 text-black px-4 py-2 rounded"
            >
              Ordini
            </button>
            <button
              onClick={() => setLogged(false)}
              className="bg-gray-700 text-white px-4 py-2 rounded"
            >
              Torna indietro
            </button>
          </div>
        </div>

        {/* Magazzino Napoli */}
        {paginaNapoli === "magazzino" && (
          <div className="p-4 space-y-6">
            <h2 className="font-bold mb-4">Magazzino Napoli</h2>
            {Object.values(
              stock.reduce((acc: any, row) => {
                const key = row.articolo + "_" + row.colore;
                if (!acc[key]) acc[key] = { ...row, taglie: [] as StockRow[] };
                acc[key].taglie.push(row);
                return acc;
              }, {})
            ).map((gruppo: any) => {
              const rows: StockRow[] = sortTaglie(
                gruppo.taglie.map((t: StockRow) => t.taglia)
              ).map((taglia) =>
                gruppo.taglie.find((t: StockRow) => t.taglia === taglia)!
              );

              return (
                <div key={gruppo.sku} className="bg-white shadow rounded-lg p-4">
                  <h2 className="font-bold mb-2">
                    {gruppo.articolo} {gruppo.categoria} – {gruppo.colore} – €
                    {Number(gruppo.prezzo).toFixed(2)}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-max border text-center">
                      <thead>
                        <tr>
                          <th className="px-2">Taglia</th>
                          {rows.map((r) => (
                            <th key={r.taglia} className="px-2">
                              {r.taglia}
                            </th>
                          ))}
                        </tr>
                        <tr>
                          <td className="px-2">Disp.</td>
                          {rows.map((r) => (
                            <td key={r.taglia}>{r.qty}</td>
                          ))}
                        </tr>
                      </thead>
                    </table>
                  </div>
                </div>
              );
            })}
            <div className="mt-4 flex gap-2">
              <button className="bg-gray-600 text-white px-4 py-2 rounded">
                Esporta CSV
              </button>
              <button className="bg-gray-600 text-white px-4 py-2 rounded">
                Esporta Excel
              </button>
              <button className="bg-red-600 text-white px-4 py-2 rounded">
                Esporta PDF
              </button>
            </div>
          </div>
        )}

        {/* Lista ordini */}
        {paginaNapoli === "ordini" && (
          <div className="p-4">
            <h2 className="font-bold mb-4">Ordini da evadere</h2>
            <table className="w-full border">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {ordini.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.customer}</td>
                    <td>{o.stato}</td>
                    <td>
                      <button
                        onClick={async () => {
                          const { data: righe } = await supabase
                            .from("order_lines")
                            .select("*")
                            .eq("order_id", o.id);
                          setOrdineSelezionato(o);
                          setRigheOrdine(righe || []);
                          setPaginaNapoli("dettaglio");
                        }}
                        className="bg-blue-600 text-white px-2 py-1 rounded"
                      >
                        Apri
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => setPaginaNapoli("magazzino")}
              className="mt-4 bg-gray-600 text-white px-4 py-2 rounded"
            >
              Torna indietro
            </button>
          </div>
        )}

        {/* Dettaglio ordine */}
        {paginaNapoli === "dettaglio" && ordineSelezionato && (
          <div className="p-4">
            <h2 className="font-bold mb-4">
              Ordine {ordineSelezionato.id} – {ordineSelezionato.customer}
            </h2>
            <table className="w-full border">
              <thead>
                <tr>
                  <th>Articolo</th>
                  <th>Taglia</th>
                  <th>Colore</th>
                  <th>Richiesti</th>
                  <th>Confermati</th>
                </tr>
              </thead>
              <tbody>
                {righeOrdine.map((r) => (
                  <tr key={r.id}>
                    <td>{r.articolo}</td>
                    <td>{r.taglia}</td>
                    <td>{r.colore}</td>
                    <td>{r.richiesti}</td>
                    <td>
                      <input
                        type="number"
                        defaultValue={r.richiesti}
                        className="border w-16 p-1 rounded"
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setRigheOrdine((prev) =>
                            prev.map((rr) =>
                              rr.id === r.id ? { ...rr, confermati: val } : rr
                            )
                          );
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => {
                  for (let r of righeOrdine) {
                    await supabase
                      .from("order_lines")
                      .update({ confermati: r.confermati ?? r.richiesti })
                      .eq("id", r.id);
                    await supabase
                      .from("stock")
                      .update({ qty: r.qty - (r.confermati ?? r.richiesti) })
                      .eq("sku", r.sku);
                  }
                  await supabase
                    .from("orders")
                    .update({ stato: "Evaso" })
                    .eq("id", ordineSelezionato.id);
                  alert("Ordine evaso!");
                  setPaginaNapoli("ordini");
                }}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Conferma Ordine
              </button>
              <button
                onClick={() => setPaginaNapoli("ordini")}
                className="bg-gray-600 text-white px-4 py-2 rounded"
              >
                Torna indietro
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Fallback ---
  return (
    <div className="p-8 text-center">
      <h2>Interfaccia non disponibile</h2>
    </div>
  );

