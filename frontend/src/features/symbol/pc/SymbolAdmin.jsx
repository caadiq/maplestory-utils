import { Routes, Route } from 'react-router-dom'
import SymbolList from './admin/SymbolList'
import SymbolForm from './admin/SymbolForm'

export default function SymbolAdmin() {
  return (
    <Routes>
      <Route index element={<SymbolList />} />
      <Route path="symbols/new" element={<SymbolForm />} />
      <Route path="symbols/:id" element={<SymbolForm />} />
    </Routes>
  )
}
