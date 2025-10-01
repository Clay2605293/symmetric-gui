import './App.css'
import './styles/globals.css' // si quieres estilos globales adicionales
import Home from './pages/Home'

export default function App() {
  return (
    <div className="shell">
      <div className="shell-inner">
        <Home />
      </div>
    </div>
  )
}
