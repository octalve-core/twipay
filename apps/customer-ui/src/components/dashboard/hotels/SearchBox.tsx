import { LuSearch } from "react-icons/lu";

const SearchBox = () => {
  return (
    <div className="relative md:my-8 max-md:mt-14 max-md:mb-5">
        <input placeholder="Search hotels..." className="w-full h-12  bg-white border border-[#344054]/20 focus:outline-[#112929]/50 rounded-lg overflow-hiddenoutline-0 placeholder:text-xs placeholder:text-[#344054] pl-10" />
        <span className="absolute left-4 top-1/2 -translate-y-1/2"><LuSearch className="text-[#344054] size-4" /></span>
    </div>
  )
}

export default SearchBox;