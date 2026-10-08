import CustomButton from "@/components/CustomButton"
import { EventsFormSchema } from "@/lib/zodSchemas/dashboard.schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import PhoneInput from "react-phone-input-2"
import { useState } from "react"
import useEventsStore from "@/stores/useEventsStore"
import BackButton from "@/components/Authentication/BackButton"

export type TEventFormData = z.infer<typeof EventsFormSchema>

const PurchaseDetails = () => {
    const [isFocused, setIsFocused] = useState(false);
    const {update, selectedEvent} = useEventsStore();

    const {
        register,
        formState: {errors},
        handleSubmit,
        control
    } =  useForm<TEventFormData>({
        resolver: zodResolver(EventsFormSchema)
    })

    const onSubmit = (data: TEventFormData) => {
        update({step: 3, data: data});
    }

  return (
    <section className="w-full max-w-[410px] mx-auto">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() => update({step: 1})}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Purchase details</p>
        </div>

        <div className="max-md:hidden">
            <BackButton action={() => update({step: 1})} className="mb-6" />
            <h1 className="font-medium text-2xl text-[#112929] mb-2">Purchase details</h1>
            <h2 className=" text-[#717171]">Please enter your recipient details for this purchase</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-14 md:mt-7 flex flex-col gap-5 md:gap-7">            
            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="fullname">Full name</label>
                <input {...register("fullname")} placeholder="Enter your full name" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="fullname" />
                {errors.fullname && <p className="text-red-500 text-sm mt-1">{errors.fullname.message}</p>}
            </div>

            <div className="w-full">
                <label className="text-[#344054] text-sm font-medium mb-2" htmlFor="lastname">Phone number</label>
                <Controller
                    name="phone"
                    control={control}
                    render={({field}) => (
                        <PhoneInput
                            country={'ng'}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="phone number"
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => {
                                setIsFocused(false)
                                field.onBlur()}
                            }
                            inputProps={{
                                name: "phone",
                                // required: true,
                            }}
                            buttonStyle={{ 
                                borderRadius: "8px 0 0 8px",
                                border: isFocused ? ".5px solid #112929" : "1px solid #D0D5DD",
                                background: "#FFFFFF",
                            }}
                            inputStyle={{
                                width: "100%",
                                outline: "0",
                                background: "#FFFFFF",
                                height: "44px",
                                border: isFocused ? "1px solid #112929" : "1px solid #D0D5DD",
                                boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04)",
                                borderRadius: "8px",
                                color: "#344054",
                            }}
                        />
                                    
                    )}
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
            </div>

            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="email">Email address</label>
                <input {...register("email")} placeholder="Enter your email address " className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="email" />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>

            <CustomButton disabled={!selectedEvent} className="w-full">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
        </form>
    </section>
  )
}

export default PurchaseDetails