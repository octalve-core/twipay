import EmptyState from "@/components/dashboard/EmptyState";
import Airlines from "@/components/dashboard/flights/Airlines";
import BookFlightForm from "@/components/dashboard/flights/BookFlightForm"
import useFlightStore from "@/stores/useFlightStore";

const FlightBookingPage = () => {
  const {airlines} = useFlightStore()

  return (
    <div className="min-h-full flex md:items-center justify-center">
        <section className="w-full max-w-[833px] mx-auto">
          <div className="flex md:gap-16">
              <BookFlightForm />
              <div className="h-[80vh] w-[1px] self-start bg-[#6670854D] sticky top-0 hidden md:block" />
              {airlines.length ? <Airlines /> : <EmptyState className="max-md:hidden h-[80vh] md:sticky top-0" text="Nothing to see here. Fill the form to continue." />}
          </div>
        </section>
    </div>
  )
}

export default FlightBookingPage