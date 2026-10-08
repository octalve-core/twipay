import { useNavigate } from "react-router-dom";
import BackButton from "@/components/Authentication/BackButton";
import EventsList from "./EventsList";
import EventDetails from "./EventDetails";

const SelectEvent = () => {
    const navigate = useNavigate()

  return (
        <section className="w-full max-w-[917px]">
            <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[747px] right-0 left-0 z-10 backdrop-blur-[2px] px-5">
                <BackButton icon action={() => navigate(-1)}/>
                <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Events</p>
            </div>

            <div className="flex md:gap-16">
                <EventsList />
                <div className="h-[80vh] w-[1px] self-start bg-[#6670854D] sticky top-0 hidden md:block" />
                <EventDetails />
            </div>
        </section>
  )
}

export default SelectEvent