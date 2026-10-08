import { cn } from "@/lib/utils"
import CustomButton from "@/components/CustomButton";
import usePurchaseDataStore from "@/stores/usePurchaseDataStore";
import BackButton from "@/components/Authentication/BackButton";
import { useNavigate } from "react-router-dom";
import { fetchDataProviders } from "@/lib/api/dashboard-apis/servicesApis";
import { useQuery } from "@tanstack/react-query";

export type TDataServiceProvider = {
  id: string;
  name: string;
  code: string;
  logo: string;
  serviceTypeCode: string;
};

export interface IDataPlan {
  id: string;
  name: string;
  code: string;
  dataType: string;
  validity: string;
  service: string;
  amount: number;
  logo: string;
}

const SelectProvider = () => {
    const navigate = useNavigate()
    const { update, providerName, providerId, step } = usePurchaseDataStore();

    const {
        data: providers,
        isLoading: fetchingProviders,
    } = useQuery<TDataServiceProvider[], Error>({
        queryKey: ["data-providers"],
        queryFn: fetchDataProviders
    })

  return (
    <section className="w-full max-w-[355px] mx-auto">
        <BackButton className="mb-8" action={() =>navigate(-1)} />
        <h1 className="font-medium text-2xl text-[#112929] ">Telecommunications provider</h1>
        <h2 className=" text-[#717171]">Select the telecom provider you are buying from</h2>

                {
                    fetchingProviders ? (
                    <div className="h-[88px] bg-gray-200 animate-pulse rounded-[10px] w-full my-8" />
                ) : (

                    <div className="h-[88px] flex items-center justify-center w-full my-8">
                        {
                            providers && providers.length && providers.slice(0, 4).map(({id, name, logo, code}, index) => (
                                <button 
                                    onClick={() => update({providerName: code, providerId: id})}
                                    key={id}
                                    className={cn(
                                            "w-full h-full flex flex-col gap-2 items-center justify-center border-[0.5px] border-[#C4C3C3] hover:bg-[#1129290D] cursor-pointer transition group",
                                            index === 0 && "rounded-l-[10px]",
                                            index === 1 && "border-l-0 border-r-0",
                                            index === 2 && "border-r-0",
                                            index === 3 && "rounded-r-[10px]",
                                            providerName === code && "bg-[#1129290D]"
                                        )}
                                >
                                    <span className={cn("bg-[#F5F5F5] rounded-full grid place-items-center size-12")}>
                                        <img src={logo} className="size-6 object-cover" />
                                    </span>
                                    <p className="text-xs text-[#101828] group-hover:text-[#112929] font-medium capitalize">{name.replace("Data", "")}</p>
                                </button>
                            ))
                        }
                    </div>
                    )
                }


        <div className="max-w-[360px] mx-auto">
            <CustomButton disabled={!providerId} onClick={() => update({step: step+1})} className="w-full">Proceed - <span className="opacity-60">Enter details</span></CustomButton>
        </div>
    </section>
  )
}

export default SelectProvider