import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('inmay-reloaded')) {
    sessionStorage.setItem('inmay-reloaded', '1')
    location.reload()
  }
})
window.addEventListener('load', () => setTimeout(() => sessionStorage.removeItem('inmay-reloaded'), 5000))
