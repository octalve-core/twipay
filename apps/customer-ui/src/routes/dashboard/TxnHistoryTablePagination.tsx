import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSearchParams } from "react-router-dom";

const TxnHistoryTablePagination = ({totalPages}: {totalPages: number}) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const page = parseInt(searchParams.get("page") || "1");

    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", newPage.toString());
        setSearchParams(params);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const getPaginationRange = () => {
        const siblingCount = 1; // pages around current page
        const totalPageNumbers = siblingCount * 2 + 5;

        if (totalPages <= totalPageNumbers) {
            // Show all pages
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const leftSiblingIndex = Math.max(page - siblingCount, 2);
        const rightSiblingIndex = Math.min(page + siblingCount, totalPages - 1);

        const showLeftDots = leftSiblingIndex > 2;
        const showRightDots = rightSiblingIndex < totalPages - 1;

        const pages: (number | string)[] = [1];

        if (showLeftDots) {
            pages.push("...");
        } else {
            for (let i = 2; i < leftSiblingIndex; i++) {
                pages.push(i);
            }
        }

        for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
            pages.push(i);
        }

        if (showRightDots) {
            pages.push("...");
        } else {
            for (let i = rightSiblingIndex + 1; i < totalPages; i++) {
                pages.push(i);
            }
        }

        pages.push(totalPages);

        return pages;
    }

  const paginationRange = getPaginationRange();

  return (
    <div className="w-full mx-auto flex items-center justify-center py-5">
        <Button
            onClick={() => handlePageChange(Math.max(page - 1, 1))}
            className="cursor-pointer border-[#D0D5DD] size-9 hover:bg-[#112929] group transition mr-2"
            variant="outline"
            size="sm"
            disabled={!hasPrevPage}
        >
            <ChevronLeft className="size-5 text-[#344054] group-hover:text-white" />
        </Button>
        {
            paginationRange.map((p, index) => {
            if (p === "...") {
                return (
                    <span
                        key={`ellipsis-${index}`}
                        className="px-2 text-[#98A2B3]"
                    >
                    ...
                    </span>
                )
            }

            const isActive = page === p;

            return (
                <Button
                    onClick={() => handlePageChange(Number(p))}
                    // disabled={isActive}
                    key={index}
                    className={cn("cursor-pointer border size-9 hover:text-[#112929] hover:bg-gray-100", isActive ? "border-[#112929] text-black" : "border-transparent text-[#98A2B3]")}
                    variant="outline"
                    size="sm"
                >
                    {p}    
                </Button>
            )})
        }
        <Button
            disabled={!hasNextPage}
            onClick={() => handlePageChange(Math.min(page + 1, totalPages))}
            className="cursor-pointer border-[#D0D5DD] size-9 hover:bg-[#112929] group transition ml-2"
            variant="outline"
            size="sm"
            >
            <ChevronRight className="size-5 text-[#344054] group-hover:text-white" />
        </Button>
    </div>
  )
}

export default TxnHistoryTablePagination