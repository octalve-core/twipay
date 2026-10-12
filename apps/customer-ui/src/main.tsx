import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {QueryClient, QueryClientProvider} from "@tanstack/react-query"
import {ReactQueryDevtools} from "@tanstack/react-query-devtools"
import './index.css'
import App from './App.tsx'
import { AuthContextProvider } from './context/AuthContext.tsx'

const querClient = new QueryClient()

// Local development inbox (compose.stack.yaml): floating button that shows captured emails and codes.
if (import.meta.env['VITE_TWIPAY_DEV_MAIL'] === 'true') {
  const widget = document.createElement('script')
  widget.src = '/__devmail/widget.js'
  widget.async = true
  document.head.append(widget)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthContextProvider>
      <QueryClientProvider client={querClient}>
        <App />
        {import.meta.env.DEV && <ReactQueryDevtools />}
      </QueryClientProvider>
    </AuthContextProvider>
  </StrictMode>,
)
