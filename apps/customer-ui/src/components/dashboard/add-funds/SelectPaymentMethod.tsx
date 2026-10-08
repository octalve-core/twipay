import { cn } from "@/lib/utils";
import CustomButton from "@/components/CustomButton";
import useAddFundsStore from "@/stores/useAddFundsStore";
import BackButton from "@/components/Authentication/BackButton";

import { MdRadioButtonChecked } from "react-icons/md";
import { MdRadioButtonUnchecked } from "react-icons/md";
import { fetchProviders, fundWallet } from "@/lib/api/dashboard-apis/walletApis";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";

export type TPaymentProvider = {
  id: string;
  name: string;
  code: string;
  logo: string;
  serviceTypeCode: string;
  paymentOptions: string[];
};

export type TGeneratedBankAccount = {
  reference: string;
  amount: string;
  serviceCharge: number;
  amountYouWillReceive: number;
  provider: string;

  paymentDetails: {
    method: "bank_transfer" | string;
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    expiresAt: string; // ISO timestamp
    reference: string;
  };

  chargeInfo: {
    serviceCharge: number;
    chargeType: "percentage" | "flat" | string;
    chargeValue: number;
  };
};

export type TFundWalletPayload = {
    provider: string, 
    method?: "bank_transfer", 
    amount: string 
}


const SelectPaymentMethod = () => {
    const {update, paymentMethod, amount} = useAddFundsStore();

    const {
        data: providers,
        isLoading,
    } = useQuery<TPaymentProvider[], Error>({
        queryKey: ["virtual-accounts-providers"],
        queryFn: fetchProviders,
    })

    const {mutate, isPending} = useMutation<TGeneratedBankAccount, AxiosError, TFundWalletPayload>({
      mutationFn: fundWallet,
      onSuccess: (data) => {
        update({generatedAccount: data})
        update({step: 3});
        (void 0)

      },
      onError: (error: AxiosError) => {
        (void 0)
        const errData = error.response?.data as { message?: string };
          if(errData.message){
              return toast.error(errData.message)
        }
        toast.error("Something went wrong, please try again")
      }
    })

    const handlePaymentMethod = () => {
        if(!paymentMethod) return;

        mutate({provider: paymentMethod?.code, amount})
    }

  return (
    <section className="w-full max-w-[360px] mx-auto max-md:self-start">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() => update({step: 1})}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Fund account</p>
        </div>

        <p className="text-sm text-[#1C1C1CCC] mt-14 mb-5 md:hidden">Please select your preferred funding method</p>

        <div className="max-md:hidden">
            <BackButton className="mb-8" action={() => update({step: 1})} />
            <h1 className="text-[#112929] font-medium text-2xl">Add funds</h1>
            <p className="text-[#717171] mt-2">Select a funding method</p>
        </div>

        <div className="w-full max-w-[360px] mx-auto md:mt-5 flex flex-col gap-2 md:gap-5">
            {
                isLoading && Array.from({length: 2}).map((_, index) => (
                    <div key={index} className="w-full rounded-[5px] bg-gray-200/70 h-[54px]" />
                ))
            }
            {
                !isLoading && providers && providers.length && providers.map((prov) => (
                  prov.paymentOptions.includes("bank_transfer") &&
                    <button key={prov.name} onClick={() => update({paymentMethod: prov})} className={cn("w-full rounded-[5px] px-3.5 border bg-white h-[54px] flex items-center gap-2 transition cursor-pointer hover:border-[#112929]", prov === paymentMethod ? "border-[#112929]" : "border-transparent")}>
                        <img className="size-[26px] object-cover" src={prov.logo} />
                        <span className="text-sm text-[#31373D]">{prov.name}</span>
                        <span className="ml-auto">
                            {
                                prov === paymentMethod ? <MdRadioButtonChecked className="size-4 text-[#112929]" /> : <MdRadioButtonUnchecked className="size-4 text-[#1C1C1C99]" /> 
                            }
                        </span>
                    </button>
                ))
            }
        </div>
        
        {
            isPending ?
            <CustomButton isLoading={isPending} disabled={isLoading || isPending || !paymentMethod} className="mt-10 md:mt-5 w-full">Generating account..</CustomButton> :
            <CustomButton isLoading={isPending} disabled={isLoading || isPending || !paymentMethod} onClick={handlePaymentMethod} className="mt-10 md:mt-5 w-full">Proceed - <span className="opacity-60">Payment</span></CustomButton>
        }
    </section>
  )
}

export default SelectPaymentMethod