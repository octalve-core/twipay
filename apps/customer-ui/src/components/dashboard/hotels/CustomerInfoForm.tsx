import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import CustomButton from "@/components/CustomButton";
import useIsMobile from "@/hooks/useIsMobile";
import InfoFormStepOne from "./InfoFormStepOne";
import InfoFormStepTwo from "./InfoFormStepTwo";
import { useNavigate } from "react-router-dom";
import { CustomerInfoFormSchema } from "@/lib/zodSchemas/dashboard.schema";
import { toast } from "sonner";
import useHotelsStore from "@/stores/useHotelsStore";

export type TFormData = z.infer<typeof CustomerInfoFormSchema>;

type TCustomerInfoForm = {
    formStep: number;
    setFormStep: React.Dispatch<React.SetStateAction<number>>;
    hotelId: string;
}

const CustomerInfoForm = ({formStep, setFormStep, hotelId}: TCustomerInfoForm) => {
    const {dob, checkin, checkout, update} = useHotelsStore()
    
    const navigate = useNavigate();

    const {
        register,
        formState: {errors},
        handleSubmit,
        control,
        trigger
    } =  useForm<TFormData>({
        resolver: zodResolver(CustomerInfoFormSchema),
        mode: "onTouched",
    })

    const onSubmit = (data: TFormData) => {
        if(!checkin || !checkout){
            toast.warning("Please fill all required fields!")
            return;
        }

        update({customerInfo: data})

        // route to confirm page
        navigate(`/dashboard/hotel/${hotelId}/confirm`);
        (void 0)
    }

    const isMobile = useIsMobile();

    const handleNextStep = async () => {
        const valid = await trigger(["firstname", "lastname", "middlename", "phone"]);
        if(!dob){
            toast.info("Please input your Date of birth!")
            return
        }

        if(valid){
            setFormStep(2);
        }
    }

  return (
    <form className="mt-10 md:mt-8" onSubmit={handleSubmit(onSubmit)}>
        {
            (formStep === 1 || isMobile) && (
                <InfoFormStepOne register={register} errors={errors} control={control} />
        )}

        {
            (formStep === 2 || isMobile) && (
                <InfoFormStepTwo register={register} errors={errors} />
        )}
            
            {/* Buttons */}
        <div className="mt-8">
            {!isMobile && formStep === 1 && (
            <CustomButton type="button" onClick={handleNextStep} className="w-full">Proceed - <span className="opacity-60">Customer info</span></CustomButton>
            )}
            {!isMobile && formStep === 2 && (
            <CustomButton className="w-full">Proceed - <span className="opacity-60">Customer info</span></CustomButton>
            )}
            {isMobile && (
            <CustomButton className="w-full">Proceed - <span className="opacity-60">Customer info</span></CustomButton>
            )}
        </div>
    </form>
  )
}

export default CustomerInfoForm