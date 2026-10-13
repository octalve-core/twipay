import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {motion} from "framer-motion"

import CustomButton from "@/components/CustomButton"
import {  TVCableFormSchema } from "@/lib/zodSchemas/dashboard.schema"
import useTVCableStore from "@/stores/useTVCableStore"
import BackButton from "@/components/Authentication/BackButton"
import { useNavigate } from "react-router-dom";
import CategoryDropdown from "./CategoryDropdown";
import PackagesDropdown from "./PackagesDropdown";

import { fetchTvProviders, getTvProducts, verifySmartcardNumber } from "@/lib/api/dashboard-apis/servicesApis"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AxiosError } from "axios"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { BsCheck2Circle } from "react-icons/bs"

export type TvProviderType = {
      id: string,
      name: string,
      code: string,
      logo: string
      serviceTypeCode: string
}

export type TvProductType = {
      id: string,
      name: string,
      code: string,
      logo: string,
      amount: number,
      validity: string
      service: string
}

export type SmartCardNoVerificationResponse = {
    valid: boolean,
    status: string,
    customerName: string,
    dueDate: string; // ISO date string
    smartCardNumber: string
}

export type VerifySmartCardPayload = {provider: string, number: string}

type TFormData = z.infer<typeof TVCableFormSchema>

const RecipientDetails = () => {
    const [pckgAmount, setPckgAmount] = useState<number | undefined>();
    const navigate = useNavigate()
    const {update, provider, package: cablePackage} = useTVCableStore();

    const {
        data: providers,
        isLoading: fetchingProviders,
        isError: fetchProvidersError
    } = useQuery<TvProviderType[], Error>({
        queryKey: ["tvcable-providers"],
        queryFn: fetchTvProviders,
    })

    const {
        data: TvProducts,
        isLoading: fetchingProducts,
        isError: fetchProductsError,
        } = useQuery<TvProductType[], Error, TvProductType[], [string, string]>({
        queryKey: ['tv-products', provider?.id as string],
        queryFn: getTvProducts,
        enabled: !!provider
    });

    const {mutate, isPending: isVerifying, data: verifiedCard, error: verifyError} = useMutation<SmartCardNoVerificationResponse, AxiosError, VerifySmartCardPayload>({
        mutationFn: verifySmartcardNumber,
        onSuccess: (data) => {
            void 0;
        },
        onError: (error: AxiosError) => {
            void 0;
        }
    })

    let verifyErrData: { message?: string } | undefined;
    if (verifyError?.response?.data) {
        verifyErrData = verifyError.response.data;
    }

    const {
        register,
        formState: {errors},
        handleSubmit,
        watch
    } =  useForm<TFormData>({
        resolver: zodResolver(TVCableFormSchema)
    })

    const smartCardNo = watch("smartcardNo");

    useEffect(() => {
        setPckgAmount(cablePackage?.amount)
    }, [cablePackage])

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
        if(smartCardNo && smartCardNo.length >= 10 && provider){
            mutate({provider: provider.code, number: smartCardNo})
        }
        }, 1000);
    
        return () => clearTimeout(delayDebounce)
    }, [smartCardNo, mutate, provider])

    const onSubmit = (data: TFormData) => {
        update({step: 2, smartCardNo: data.smartcardNo});
    }

  return (
    <section className="w-full max-w-[360px] mx-auto">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() =>navigate(-1)}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Buy TV/Cable</p>
        </div>
        <div className="hidden md:block">  
            <BackButton className="mb-8" action={() =>navigate(-1)} /> 
            <h1 className="font-medium text-2xl text-[#112929] ">Select Provider & Package</h1>
            <h2 className=" text-[#717171]">Please select the category that best suits you</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-14 md:mt-5 flex flex-col gap-5">            
            <CategoryDropdown error={fetchProvidersError} isLoading={fetchingProviders} categoriesArr={providers} />

            <PackagesDropdown error={fetchProductsError} disable={!provider} isLoading={fetchingProducts} packagesArr={TvProducts} />

            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="smartcard-number">Smartcard number</label>
                <input {...register("smartcardNo")} placeholder="Enter smartcard number" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="smartcard-number" />
                {
                    (!isVerifying && verifyErrData ) && <p className="text-red-500 text-sm mt-1">{verifyErrData?.message}</p>
                }
                
                {isVerifying && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex items-center gap-2"><Loader2 className="animate-spin size-4 mt-2" /> <span className="italic text-sm">Verifying smartcard number</span></motion.div>}
                {
                    verifiedCard && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex mt-1 items-center gap-2">
                        <div className="grid place-items-center size-6 rounded-full border-2 border-[#039855] bg-[#12B76A] text-white"><BsCheck2Circle className="size-2.5" /> </div>
                        <p className="text-sm font-medium">{verifiedCard.customerName}</p>
                    </motion.div>
                }
                {errors.smartcardNo && <p className="text-red-500 text-sm mt-1">{errors.smartcardNo.message}</p>}
            </div>

            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="amount">Amount</label>
                <div className="w-full h-fit relative mt-1.5">
                    <input disabled defaultValue={pckgAmount} className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929]" id="amount" />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2">₦</span>
                </div>
            </div>

            <CustomButton disabled={!provider || !cablePackage || !verifiedCard} className="w-full">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
        </form>
    </section>
  )
}

export default RecipientDetails