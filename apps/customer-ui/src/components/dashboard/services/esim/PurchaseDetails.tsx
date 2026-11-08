import CustomButton from "@/components/CustomButton"
import { ESimFormSchema } from "@/lib/zodSchemas/dashboard.schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";

  import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
  } from "@/components/ui/command"
  
  import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "@/components/ui/popover"
  
  import { Check, ChevronDown } from "lucide-react";

import useESimStore from "@/stores/useESimStore"
import BackButton from "@/components/Authentication/BackButton"
import { useNavigate } from "react-router-dom"
import ProvidersDropdown from "./ProvidersDropdown"
import { useState } from "react"
import { countryArr } from "./SelectProvider"
import { cn } from "@/lib/utils"

type TFormData = z.infer<typeof ESimFormSchema>

const providersArr = [
    {
        value: "Celtel",
        label: "Celtel",
    },
]

const PurchaseDetails = () => {
     const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const navigate = useNavigate()
    const {update, step, country, provider} = useESimStore();

    const {
        formState: {errors},
        handleSubmit,
        control
    } =  useForm<TFormData>({
        resolver: zodResolver(ESimFormSchema)
    })

    const onSubmit = (data: TFormData) => {
        update({step: step+1, validity: data.validity});
    }

  return (
    <section className="w-full max-w-[410px] mx-auto">
        <div className="flex items-center mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() =>navigate(-1)}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Buy ESim</p>
        </div>

        <div className="hidden md:block">
            <BackButton className="mb-8" action={() => update({step: step-1})} /> 
            <h1 className="font-medium text-2xl text-[#112929] ">Purchase details</h1>
            <h2 className=" text-[#717171]">Please enter your recipient details for this purchase</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-14 md:mt-5 flex flex-col gap-5">            
            <div className="w-full md:hidden">
                <label className="text-sm text-[#344054] font-medium" htmlFor="account">Select country</label>
                <Popover open={showCountryDropdown} onOpenChange={setShowCountryDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
                            aria-expanded={open}
                            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                        >
                            {country
                                ? <span className="text-[#344054]">{countryArr.find((ctry) => ctry.value === country)?.label}</span>
                                : "Select country"}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </CustomButton>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[90vw] md:w-[361px]">
                        <Command className="">
                            <CommandInput className="" placeholder="search..." />
                            <CommandList className="w-full px-3.5">
                                <CommandEmpty>No ctry found.</CommandEmpty>
                                <CommandGroup className="px-0">
                                {countryArr.map((ctry) => (
                                    <CommandItem
                                        className={cn("text-[#344054] justify-between", country && ctry.value === country && "font-medium")}
                                        key={ctry.value}
                                        value={ctry.value}
                                        onSelect={(currentValue) => {
                                            update({country: currentValue === country ? "" : currentValue})
                                            setShowCountryDropdown(false)
                                        }}
                                    >
                                        {ctry.label}
                                    <Check
                                        className={cn(
                                        "mr-2 h-4 w-4",
                                        country === ctry.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            <ProvidersDropdown providersArr={providersArr} />

            <Controller
                name="validity"
                control={control}
                rules={{ required: true}}
                render={({field}) => (
                    <div className="w-full">
                        <label className="text-sm text-[#344054] font-medium" htmlFor="account">Select Validity</label>
                        <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-placeholder:text-[#667085]">
                                <SelectValue placeholder="Select validity"/>
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectGroup>
                                    <SelectItem className="capitalize" value={"90"}>90 days</SelectItem>
                                    <SelectItem className="capitalize" value={"180"}>180 days</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        {errors.validity && <p className="text-red-600 text-sm mt-1">{errors.validity.message}</p>}
                    </div>
                )}
            />

            <CustomButton disabled={!country || !provider} className="w-full">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
        </form>
    </section>
  )
}

export default PurchaseDetails