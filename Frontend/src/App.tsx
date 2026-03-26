import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect } from "react"
import Auth from "./pages/Auth"
import Chat from "./pages/Chat"
import Admin from "./pages/Admin"
import Home from "./pages/Home"
import Playground from "./pages/Playground"
import NotFoundPage from "./pages/NotFound"
import { isAuthenticated } from "./lib/auth"

function App() {
  useEffect(() => {
    isAuthenticated()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/playground" element={<Playground/>}/>
        <Route path="/admin/*" element={<Admin />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App