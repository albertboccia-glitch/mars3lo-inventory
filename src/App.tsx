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
