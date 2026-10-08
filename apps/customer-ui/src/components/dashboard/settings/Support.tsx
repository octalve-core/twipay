import CustomButton from "@/components/CustomButton"
import { SupportFormSchema } from "@/lib/zodSchemas/dashboard.schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import WhatsappLogo from "@/assets/dashboard/WhatsappLogo.svg"
import BackButton from "@/components/Authentication/BackButton"

type TFormData = z.infer<typeof SupportFormSchema>

const Support = () => {

   const {
            register,
            formState: {errors},
            handleSubmit,
    } = useForm<TFormData>({
        resolver: zodResolver(SupportFormSchema)
    })

    const onSubmit = (data: TFormData) => {
        (void 0)
    }

  return (
    <div className="min-h-full flex md:items-center justify-center">
        <section className="w-full max-w-[360px] mx-auto">
            <div className="flex items-center mb-7 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
              <BackButton icon href="/dashboard/settings"/>
              <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Support</p>
            </div>

            <div className="hidden md:block">
                <BackButton href="/dashboard/settings" className="mb-5" />  
                <h1 className="text-[#112929] font-bold text-[28px] ">Support</h1>
            </div>
            <p className="max-md:text-xl max-md:font-bold max-md:text-center text-[#344054] md:text-[#727884] md:text-sm max-md:mt-14">Get in touch <span className="max-md:hidden">with us.</span></p>

            <form className="mt-10 md:mt-5" onSubmit={handleSubmit(onSubmit)}>
                <div className="w-full mt-5">
                    <label className="text-[#344054] text-sm font-medium" htmlFor="username">Username</label>
                    <input {...register("username")} placeholder="enter your username" type="text" id="username" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] text-[#344054] text-sm rounded-md mt-1 focus:border-[#112929] transition placeholder:text-[#667085]" />
                    {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username.message}</p>}
                </div>

                <div className="w-full mt-5">
                    <label className="text-[#344054] text-sm font-medium" htmlFor="email">Email address</label>
                    <input {...register("email")} placeholder="enter your email address" type="email" id="email" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] text-[#344054] text-sm rounded-md mt-1 focus:border-[#112929] transition placeholder:text-[#667085]" />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                </div>

                <div className="w-full mt-5">
                    <label className="text-[#344054] text-sm font-medium" htmlFor="email">Message</label>
                    <textarea {...register("message")} id="email" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] text-[#344054] text-sm rounded-md mt-1 focus:border-[#112929] transition placeholder:text-[#667085]" />
                    {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message.message}</p>}
                </div>

                <CustomButton className="mt-5 w-full">Send mail</CustomButton> 

                <div className="mt-20 md:mt-12 flex flex-col gap-3 w-full">
                    <CustomButton type="button" variant="primary" className="flex items-center justify-center gap-3 text-[#344054] border border-[#D0D5DD]">
                        <img src={WhatsappLogo} className="size-6 object-cover" />
                        <span className="font-medium">Chat on whatsapp</span>    
                    </CustomButton>    
                    <CustomButton type="button" className="flex items-center justify-center gap-3 bg-black border border-[#D0D5DD] font-medium">
                            Call an agent (+2349079381221) 
                    </CustomButton>    
                </div>            
            </form>
        </section>
    </div>
  )
}

export default Support