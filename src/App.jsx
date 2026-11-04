import { Routes, Route } from 'react-router-dom'
import { SettingsProvider } from './components/Settings.jsx'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Products from './pages/Products.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Collections from './pages/Collections.jsx'
import CollectionDetail from './pages/CollectionDetail.jsx'
import CustomOrder from './pages/CustomOrder.jsx'
import NotFound from './pages/NotFound.jsx'
import AdminApp from './admin/AdminApp.jsx'

export default function App() {
  return (
    <SettingsProvider>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/san-pham" element={<Products />} />
          <Route path="/san-pham/:slug" element={<ProductDetail />} />
          <Route path="/bo-suu-tap" element={<Collections />} />
          <Route path="/bo-suu-tap/:slug" element={<CollectionDetail />} />
          <Route path="/dat-rieng" element={<CustomOrder />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </SettingsProvider>
  )
}
