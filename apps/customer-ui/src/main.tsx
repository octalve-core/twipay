import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {QueryClient, QueryClientProvider} from "@tanstack/react-query"
import {ReactQueryDevtools} from "@tanstack/react-query-devtools"
import './index.css'
import App from './App.tsx'
import { AuthContextProvider } from './context/AuthContext.tsx'

const querClient = new QueryClient()

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
