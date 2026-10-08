import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CustomerInfoForm from "./CustomerInfoForm";
import BackButton from "@/components/Authentication/BackButton";

const CustomerInfo = () => {
    const [formStep, setFormStep] = useState(1);
    const navigate = useNavigate()
    const {id} = useParams();

        useEffect(() => {
            if (!id) {
              navigate("/dashboard/hotels");
            }
          }, [id, navigate]);

  return (
    <div className="min-h-full flex md:items-center justify-center">
        <section className="w-full max-w-[360px] mx-auto">
            <div className="flex items-center mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
                <BackButton icon href="/dashboard/hotels"/>
                <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Customer info</p>
            </div>

            <div className="max-md:hidden">
                {
                  formStep === 1 ? (
                    <BackButton href="/dashboard/hotels" className="mb-8" />
                  ) : (
                    <BackButton action={() => setFormStep(1)} className="mb-8" />
                  )
                }
                <h1 className="text-2xl font-medium text-[#112929]">Customer info <span>({formStep}/2)</span></h1>
                <p className="text-[#717171] mt-2 mb-8">Kindly enter your flight details below.</p>
            </div>
  
            <p className="md:hidden mt-12 md:mt-4 text-[#344054] text-center">Kindly enter your booking details below.</p>

            <CustomerInfoForm hotelId={id as string} formStep={formStep} setFormStep={setFormStep} />
        </section>
    </div>
  )
}

export default CustomerInfo