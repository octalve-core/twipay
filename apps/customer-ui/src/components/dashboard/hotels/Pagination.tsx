import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
  } from "@/components/ui/pagination"
  
const HotelsPagination = () => {
  return (
    <section className="mt-5 mb-8 py-3 px-6">
    <Pagination>
        <PaginationContent className="flex items-center justify-between w-full">
            <PaginationItem>
                <PaginationPrevious className="font-medium text-sm rounded-lg border border-[#D0D5DD] hover:bg-[#D0D5DD]/20 transition py-2 px-3.5" href="#" />
            </PaginationItem>
            <div className="flex items-center">
                <PaginationItem>
                    <PaginationLink className="font-medium text-sm rounded-lg p-3 bg-[#F9F5FF]" href="#">1</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                    <PaginationEllipsis />
                </PaginationItem>
                <PaginationItem>
                    <PaginationLink className="font-medium text-sm" href="#">5</PaginationLink>
                </PaginationItem>
            </div>
            <PaginationItem>
                <PaginationNext className="font-medium text-sm rounded-lg border border-[#D0D5DD] hover:bg-[#D0D5DD]/20 transition py-2 px-3.5" href="#" />
            </PaginationItem>
        </PaginationContent>
    </Pagination>
</section>
  )
}

export default HotelsPagination;