import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CoordinatorApp } from './pages/CoordinatorApp'
import { BookPage } from './pages/BookPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CoordinatorApp />} />
        <Route path="/book" element={<BookPage />} />
      </Routes>
    </BrowserRouter>
  )
}
