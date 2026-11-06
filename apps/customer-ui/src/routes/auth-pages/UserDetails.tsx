import { useNavigate } from "react-router-dom";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

// import BackButton from "@/components/Authentication/BackButton"
import CustomButton from "@/components/CustomButton";
import { userDetailsFormSchema } from "@/lib/zodSchemas/auth.schema";

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

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
// import Logo from "@/components/navbar/Logo";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchCountries, updateProfile } from "@/lib/api/authApi";
import api from "@/lib/api/axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { AxiosError } from "axios";
import Loader from "@/components/Loader";
import BackButton from "@/components/Authentication/BackButton";
import Logo from "@/components/navbar/Logo";

export interface ICountry {
  id: number;
  name: string;
  code: string;
  iso2: string;
  iso3: string;
  phone_code: string;
  region: string;
  emoji: string;
  emoji_code: string;
  capital: string;
  currency: string;
  currency_name: string;
  currency_symbol: string;
  longitude: string;
  latitude: string;
  flag: string;
  can_do_airtime: boolean;
  airtime_activated_at: string | null;
  created_at: string;
}

export interface IState {
  id: number;
  name: string;
  code: string;
  longitude: string;
  latitude: string;
  created_at: string;
}


export type TFormData = z.infer<typeof userDetailsFormSchema>

const UserDetails = () => {
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [showStateDropdown, setShowStateDropdown] = useState(false);

    const [authChecked, setAuthChecked] = useState(false);

    const { setAuthData, accessToken, refreshToken, user} = useAuth()

    const [country, setCountry] = useState("");
    const [state, setState] = useState("");

    const navigate = useNavigate();

    const {
            register,
            handleSubmit,
            control,
            formState: {errors}
        } = useForm<TFormData>({
            resolver: zodResolver(userDetailsFormSchema)
        })

    const {
        data: countries,
        isLoading: fetchingCountries,
        error: countriesError
    } = useQuery<ICountry[], Error>({
        queryKey: ["countries"],
        queryFn: fetchCountries,
    })
    const selectedCountry = country && countries && countries.length ? countries.find((ctry) => ctry.name === country) : null;

    const fetchStates = async () => {
        const res = await api.get(
            `/reference/states/${selectedCountry?.id}?page=1&limit=1000`
        )
        return res.data.data;
    }

    const {
        data: states,
        isLoading: fetchingStates,
        error: statesError
    } = useQuery<IState[], Error>({
        queryKey: ["states", selectedCountry?.id],
        queryFn: fetchStates,
        enabled: !!selectedCountry?.id
    })

    const {mutate, isPending: updatingProfile} = useMutation({
        mutationFn: updateProfile,
        onSuccess: (data) => {
            const userDetails = data?.userDetails
            setAuthData(userDetails, accessToken as string, refreshToken as string)
            toast.success("Profile updated successfully!")
            navigate("/auth/verify-phone")
        },
        onError: (error: AxiosError) => {
            const errData = error.response?.data as { message?: string };
            if(errData.message){
                return toast.error(errData.message)
            }
            toast.error("Something went wrong, please try again")
        }
    })

    const onSubmit = (data: TFormData) => {
        mutate({...data, country, state})
    }

    useEffect(() => {
        if (accessToken === null || user === null) {
            navigate("/auth/signup");
        }else if (user.username && user.gender && user.country && user.state) {
            navigate("/auth/verify-phone");
        }else {
            setAuthChecked(true)
        }
    }, [accessToken, navigate, user]);

    if(!authChecked) return <Loader />

  return (
    <div className="flex flex-col items-center justify-center h-full px-5 md:px-0 py-10">
        <div className="w-full max-w-[410px]">
            <BackButton href="/" className="max-md:hidden" />
            <Logo imgClassName="w-[91.5px] h-10 md:hidden" />
        </div>
        <div className="md:text-center mt-6 max-md:mt-10">
            <h1 className="text-4xl text-[#101828] font-medium">Complete sign up <span className="text-[#112929]">(3/4)</span></h1>
            <p className="mt-3 text-[#475467]">Complete sign up process</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[410px] mt-8">
            <div className="w-full">
                <label className="text-[#344054] text-sm font-medium" htmlFor="username">Username</label>
                <input id="username" {...register("username")} placeholder="AnnaKe1" className="w-full outline-0 bg-white py-3 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" />
                {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username.message}</p>}
            </div> 
            {/*Gender select  */}
            <Controller
                name="gender"
                control={control}
                rules={{ required: true}}
                render={({field}) => (
                    <div className="mt-5 w-full">
                        <label className="text-[#344054] text-sm font-medium" htmlFor="gender">Gender</label>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="w-full py-3 !h-12 mt-2 px-3.5 border border-[#D0D5DD] shadow-[#1018280D]">
                                <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent className="bg-white outline-0">
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            />
            {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender.message}</p>}
            {/*Country select  */}
            <div className="mt-5 w-full">
                <label className="text-[#344054] text-sm font-medium" htmlFor="country">Country</label>
                <Popover open={showCountryDropdown} onOpenChange={setShowCountryDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
                            disabled={fetchingCountries}
                            aria-expanded={open}
                            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                        >
                            {country
                                ? <div className="text-[#344054] flex items-center gap-2">
                                    <img alt="" src={selectedCountry?.flag} className="size-5 rounded-full object-cover" />
                                    <span>{selectedCountry?.name}</span>
                                </div>
                                : `${fetchingCountries ? "Loading countries..." : "Select country"}`}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </CustomButton>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[90vw] md:w-[410px]">
                        <Command className="">
                            <CommandInput className="" placeholder="search..." />
                            <CommandList className="w-full px-3.5">
                                <CommandEmpty>No country found.</CommandEmpty>
                                <CommandGroup className="px-0">
                                {countries && countries.length && countries.map((ctry) => (
                                    <CommandItem
                                        className={cn("text-[#344054] justify-between", country && ctry.name === country && "font-medium")}
                                        key={ctry.id}
                                        value={ctry.name}
                                        onSelect={(currentValue) => {
                                            setCountry((prev) => {
                                                const newCountry = prev === currentValue ? "" : currentValue;
                                                setState("");
                                                return newCountry;
                                            })
                                            setShowCountryDropdown(false)
                                        }}
                                    >
                                        <div className="text-[#344054] flex items-center gap-2">
                                            <img alt="" src={ctry.flag} className="size-5 rounded-full bg-gray-100 object-cover" />
                                            <span>{ctry.name}</span>
                                        </div>
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            country === ctry.name ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {(countriesError && !countries?.length) && <p className="text-red-500 mt-1 text-sm">Failed to load countries. Please refresh.</p>}
            </div>
            {/*state select  */}
            <div className="mt-5 w-full">
                <label className="text-[#344054] text-sm font-medium" htmlFor="state">State</label>
                <Popover open={showStateDropdown} onOpenChange={setShowStateDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
                            disabled={fetchingStates || !country}
                            aria-expanded={open}
                            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                        >
                            {state
                                ? <span className="text-[#344054]">{state}</span>
                                : `${fetchingStates ? "Loading states..." : "Select state"}`}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </CustomButton>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[90vw] md:w-[410px]">
                        <Command className="">
                            <CommandInput className="" placeholder="search..." />
                            <CommandList className="w-full px-3.5">
                                <CommandEmpty>No states found.</CommandEmpty>
                                <CommandGroup className="px-0">
                                {states && states.map((st) => (
                                    <CommandItem
                                        className={cn("text-[#344054] justify-between", state && st.name === state && "font-medium")}
                                        key={st.id}
                                        value={st.name}
                                        onSelect={(currentValue) => {
                                            setState((prev) => prev === currentValue ? "" : currentValue)
                                            setShowStateDropdown(false)
                                        }}
                                    >
                                        {st.name}
                                    <Check
                                        className={cn(
                                        "mr-2 h-4 w-4",
                                        state === st.name ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {(statesError && !states?.length) && <p className="text-red-500 mt-1 text-sm">Failed to load states. Please refresh.</p>}
            </div>
            <CustomButton isLoading={updatingProfile} disabled={!country || !state || updatingProfile} className="mt-6 w-full">Proceed - <span className="opacity-60">Verify phone</span></CustomButton>
        </form>
    </div>
  )
}

export default UserDetails