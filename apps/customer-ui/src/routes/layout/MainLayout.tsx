import { Outlet } from "react-router-dom"
import Navbar from "../../components/navbar/Navbar"
import Footer from "../../components/footer/Footer"
import ScrollToTop from "@/components/ScrollToTop"


const MainLayout = () => {
  return (
    <div className="min-h-screen overflow-x-hidden">
        <Navbar />
        <main className="mt-[92px] md:mt-[105px]">  
          <ScrollToTop>
            <Outlet />
          </ScrollToTop>
        </main>
        <Footer />
    </div>
  )
}

export default MainLayout