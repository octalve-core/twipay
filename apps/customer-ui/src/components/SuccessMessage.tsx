import CheckMark from "@/assets/auth/checkmark-done.png"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

type TSuccessMessage = {
    message: string;
}

const SuccessMessage = ({message}: TSuccessMessage) => {
    const navigate = useNavigate()

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate("/dashboard");
        }, 2000)

        return () => clearTimeout(timer)
    }, [navigate])

  return (
    <div className='grid place-items-center min-h-screen'>
        <div className="max-w-[702px] text-center flex flex-col items-center">
            <img src={CheckMark} className="object-cover w-[248px] h-[226px]" />
            <h2 className="text-black font-medium text-4xl mt-5 mb-4">{message}</h2>
            <p className="text-[#717171]">Redirecting to home...</p>
        </div>
    </div>
  )
}

export default SuccessMessage