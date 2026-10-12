import { Outlet } from "react-router-dom"
import ScrollToTop from "@/components/ScrollToTop"

const AuthLayout = () => {
  return (
        <main className="min-h-screen">  
          <ScrollToTop>
            <Outlet />
          </ScrollToTop>
        </main>
  )
}

export default AuthLayout;