import BackButton from "@/components/Authentication/BackButton";
import HotelsList from "@/components/dashboard/hotels/HotelsList"
import HotelsPagination from "@/components/dashboard/hotels/Pagination";
import SearchBox from "@/components/dashboard/hotels/SearchBox"

const SelectHotel = () => {
  return (
    <section className="w-full">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[747px] right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon href="/dashboard"/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Hotel booking</p>
        </div>

        <div className="max-md:hidden">
            <BackButton href="/dashboard" className="mb-8" />
            <h1 className="text-[#112929] text-2xl font-medium">Hotel booking</h1>
            <p className="text-[#717171] mt-2 mb-8">Please select the hotel you want to book</p>
        </div>
        <SearchBox />
        <HotelsList />
        <HotelsPagination /> 
    </section>
  )
}

export default SelectHotel