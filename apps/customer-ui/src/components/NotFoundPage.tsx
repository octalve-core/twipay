import NotFound from "@/assets/dashboard/404.png"
import { useNavigate } from "react-router-dom"

const NotFoundPage = () => {
    const navigate = useNavigate();
  return (
    <div className="h-screen grid place-items-center">
        <div className="text-center flex flex-col items-center px-5">
            <img className="size-80" src={NotFound} />
            <p className="font-medium text-3xl">Ooops! Looks like you've hit the wrong route</p>
            <button onClick={() => navigate(-1)} className="cursor-pointer text underline mt-3">Go back</button>
        </div>
    </div>
  )
}

export default NotFoundPage