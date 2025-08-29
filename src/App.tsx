import React, { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
)

export default function App() {
  const [stock, setStock] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pin, setPin] = useState("")
  const [magazzinoMode, setMagazzinoMode] = useState(false)

  useEffect(() => {
    loadStock()
    const sub = supabase
      .channel('realtime stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, payload => {
        loadStock()
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  async function loadStock() {
    setLoading(true)
    const { data, error } = await supabase.from('stock').select('*').order('articolo')
    if (!error) setStock(data || [])
    setLoading(false)
  }

  function checkPin() {
    if (pin === "1234") setMagazzinoMode(true)
    else alert("PIN errato")
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mars3lo Inventory</h1>
      {!magazzinoMode && (
        <div className="mb-4">
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN Magazzino" className="border p-2 mr-2"/>
          <button onClick={checkPin} className="bg-blue-500 text-white px-4 py-2 rounded">Entra Magazzino</button>
        </div>
      )}
      {loading ? <p>Caricamento...</p> : (
        <table className="table-auto w-full bg-white shadow rounded">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2">Articolo</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Taglia</th>
              <th className="p-2">Colore</th>
              <th className="p-2">Q.tà</th>
              <th className="p-2">Prezzo</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{r.articolo}</td>
                <td className="p-2">{r.categoria}</td>
                <td className="p-2">{r.taglia}</td>
                <td className="p-2 font-bold">{r.colore}</td>
                <td className="p-2">{r.qty}</td>
                <td className="p-2">€ {r.prezzo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
