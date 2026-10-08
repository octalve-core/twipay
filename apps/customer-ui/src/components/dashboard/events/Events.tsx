import useEventsStore from "@/stores/useEventsStore";
import { EventsSteps } from "./constants";
import { useEffect } from "react";

const Events = () => {
    const {step, reset} = useEventsStore();
    const CurrentComponent = EventsSteps[step - 1].component;

    useEffect(() => {
        reset(); // resets to step 1 when Events mounts
      }, [reset]);
    
    return (
        <div className="min-h-full flex md:items-center justify-center">
            <CurrentComponent />
        </div>
      )
}

export default Events