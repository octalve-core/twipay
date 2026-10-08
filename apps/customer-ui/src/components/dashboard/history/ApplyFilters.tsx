import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import CalenderIcon from "@/assets/dashboard/calendar.svg"
import CustomButton from "@/components/CustomButton";
import { useSearchParams } from "react-router-dom";

const services = ["airtime", "betting", "data", "internationalAirtime", "internationalData", "electricity", "education", "tv_subscription", "wallet_transfer", "withdrawal", "flight"]

const ApplyFilters = ({setOpen}: {setOpen: React.Dispatch<React.SetStateAction<boolean>>}) => {
    const [searchParams, setSearchParams] = useSearchParams();
    
    const status = searchParams.get("status") || "";
    const startDateParam = searchParams.get("startDate") || "";
    const endDateParam = searchParams.get("endDate") || "";
    const startPrice = searchParams.get("startPrice") || "";
    const endPrice = searchParams.get("endPrice") || "";
    const type = searchParams.get("type") || "";
    
    const [startDate, setStartDate] = useState<Date | null>(startDateParam ? new Date(startDateParam) : null);
    const [endDate, setEndDate] = useState<Date | null>(endDateParam ? new Date(endDateParam) : null);
    const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: startPrice, max: endPrice});
    const [selectedStatus, setSelectedStatus] = useState(status);
    const [selectedService, setSelectedService] = useState(type);

    const startDateInputRef = useRef<HTMLInputElement>(null);
    const endDateInputRef = useRef<HTMLInputElement>(null);

    // const ONE_DAY = 24 * 60 * 60 * 1000
    const currentDate = new Date(Date.now());

    const handleOpenPicker = (inputRef: React.RefObject<HTMLInputElement | null>) => {
        if (inputRef.current) {
            inputRef.current.showPicker(); // programmatically open the date picker
        }
    };

    const handleSetStartDatePicker = (value: Date | null) => {
        if(value && value > currentDate ){
            toast.info("You cannot select a day in the future");
            return
        }
        if(endDate && value && value > endDate ){
            toast.info("Start date cannot be after end date");
            return
        }

        setStartDate(value);
    }

    const handleSetEndDatePicker = (value: Date | null) => {
        if(value && value > currentDate ){
            toast.info("You cannot select a day in the future");
            return
        }
        if(startDate && value && value < startDate ){
            toast.info("End date cannot before start date");
            return
        }

        setEndDate(value);
    }

    const handleApplyFilters = (e: FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams(searchParams);

    // Update the start date if available
    if (startDate) {
        params.set("startDate", startDate.toISOString().split("T")[0]);
    } else {
        params.delete("startDate");
    }

    // Update the start date if available
    if (endDate) {
        params.set("endDate", endDate.toISOString().split("T")[0]);
    } else {
        params.delete("endDate");
    }

    // Update min price if available
    if (priceRange.min) {
        params.set("startPrice", priceRange.min);
    } else {
        params.delete("startPrice");
    }

    // Update max price if available
    if (priceRange.max) {
        params.set("endPrice", priceRange.max);
    } else {
        params.delete("endPrice");
    }

    // Update status if selected
    if (selectedStatus) {
        params.set("status", selectedStatus);
    } else {
        params.delete("status");
    }

    // Update service if selected
    if (selectedService) {
        params.set("type", selectedService);
    } else {
        params.delete("type");
    }

    params.delete("page"); 

    // Update the URL without overriding other params
    setSearchParams(params);

    setOpen(false);
    toast.success("Filters applied!");
    };

    const handleResetFilters = () => {
        setSearchParams({});
        setOpen(false);
    }

  return (
    <div className="w-full h-full pt-8 md:pt-10 pb-5 md:pb-6 px-4 overflow-y-auto scroll-bar-y">
        <div className="flex items-center justify-between">
            <h1 className="text-xl text-[#344054] font-medium">Filter</h1>
            <X onClick={() => setOpen(false)} className="size-6 text-[#344054] cursor-pointer hover:opacity-75 transition" />
        </div>
        <form onSubmit={handleApplyFilters} className="mt-7 md:mt-9 flex flex-col gap-5 md:gap-7">
            <div>
                <label htmlFor="price" className="text-[#98A0B4] text-sm mb-2">Price range</label>
                <div className="flex items-center gap-4">
                    <div className="w-full h-[38px] relative mt-1.5">
                        <input value={priceRange.min} onChange={(e) => setPriceRange(prev => ({...prev, min: e.target.value})) } placeholder="min" className="w-full h-full border-[0.5px] border-[#D0D5DD] rounded-[5px] px-3.5 pr-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085] text-sm" type="number" min={1} id="price" />
                        <span className="absolute right-3.5 text-sm text-[#344054] top-1/2 -translate-y-1/2">₦</span>
                    </div>
                    <div className="w-full h-[38px] relative mt-1.5">
                        <input value={priceRange.max} onChange={(e) => setPriceRange(prev => ({...prev, max: e.target.value})) } placeholder="max" className="w-full h-full border-[0.5px] border-[#D0D5DD] rounded-[5px] px-3.5 pr-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085] text-sm" type="number" min={1} id="price" />
                        <span className="absolute right-3.5 text-sm text-[#344054] top-1/2 -translate-y-1/2">₦</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="w-full">
                    <label htmlFor="date" className="text-[#98A0B4] text-sm mb-2">Start Date</label>
                    <div className="flex items-center gap-4">
                        <div
                            onClick={() => handleOpenPicker(startDateInputRef)}
                            className={cn(
                                "w-full h-[38px] cursor-pointer flex items-center px-3.5 justify-between text-sm font-normal border-[0.5px] border-[#D0D5DD] rounded-lg bg-white outline-none focus-within:border-[#112929]",
                                !startDate && "text-[#667085]"
                            )}
                            >
                            <input
                                id="date"
                                ref={startDateInputRef}
                                type="date"
                                onKeyDown={(e) => e.preventDefault()} // Prevent typing
                                value={startDate ? startDate.toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                    if (!e.target.value) return handleSetStartDatePicker(null);
                                    handleSetStartDatePicker(new Date(e.target.value));
                                }}
                                placeholder="Pick a date"
                                className="bg-transparent cursor-pointer h-full outline-none border-none flex-1 placeholder:text-[#667085] text-sm font-normal"
                            />
                            <img className="size-[16px] cursor-pointer" src={CalenderIcon} alt="Calendar Icon" />
                        </div>
                    </div>
                </div>
                <div className="w-full">
                    <label htmlFor="date" className="text-[#98A0B4] text-sm mb-2">End Date</label>
                    <div className="flex items-center gap-4">
                        <div
                            onClick={() => handleOpenPicker(endDateInputRef)}
                            className={cn(
                                "w-full h-[38px] cursor-pointer flex items-center px-3.5 justify-between text-sm font-normal border-[0.5px] border-[#D0D5DD] rounded-lg bg-white outline-none focus-within:border-[#112929]",
                                !endDate && "text-[#667085]"
                            )}
                            >
                            <input
                                id="date"
                                ref={endDateInputRef}
                                type="date"
                                onKeyDown={(e) => e.preventDefault()} // Prevent typing
                                value={endDate ? endDate.toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                    if (!e.target.value) return handleSetEndDatePicker(null);
                                    handleSetEndDatePicker(new Date(e.target.value));
                                }}
                                placeholder="Pick a date"
                                className="bg-transparent cursor-pointer h-full outline-none border-none flex-1 placeholder:text-[#667085] text-sm font-normal"
                            />
                            <img className="size-[16px] cursor-pointer" src={CalenderIcon} alt="Calendar Icon" />
                        </div>
                    </div>
                </div>
            </div>
            <div>
                <p className="text-[#98A0B4] text-sm mb-2">Status</p>
                <div className="flex flex-col gap-4">
                    {
                        ["successful", "failed", "pending", "reversed"].map((status) => (
                            <div key={status} className="flex items-center">
                                <input checked={selectedStatus === status} onClick={() => setSelectedStatus(status)} id={status} type="checkbox" className="w-5 h-5 accent-[#112929] cursor-pointer border border-[#D0D5DD]" />
                                <label htmlFor={status} className="text-[#344054] text-sm ml-2.5 capitalize">{status}</label>
                            </div>
                        ))
                    }
                </div>
            </div>
            <div>
                <p className="text-[#98A0B4] text-sm mb-2">Service</p>
                <div className="flex items-center gap-4 flex-wrap">
                    {
                        services.map(service => {
                            const isSelected = selectedService === service;
                            
                            return (
                                <button 
                                    type="button"
                                    onClick={() => setSelectedService(service)} 
                                    key={service} 
                                    className={cn(" rounded-[2px] px-2.5 py-2 text-xs capitalize cursor-pointer", isSelected ? "bg-[#112929] text-white" : "bg-[#F2F4F7] text-[#344054]")}>{service.replaceAll("_", " ")}</button>
                            )
                        })
                    }
                </div>
            </div>
            <div className="flex flex-col gap-2 mt-8">
                <CustomButton className="font-medium">Apply</CustomButton>
                <CustomButton onClick={handleResetFilters} type="button" className="md:border border-[#112929] max-md:text-[#112929] font-medium" variant="primary">Reset <span className="max-md:hidden">filters</span></CustomButton>
            </div>
        </form>
    </div>
  )
}

export default ApplyFilters