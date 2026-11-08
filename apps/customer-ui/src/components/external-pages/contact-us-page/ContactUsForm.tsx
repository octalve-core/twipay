import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'

import ContactUsImg from "../../../assets/main-pages/contact_us.png"
import { useState } from 'react';
import { contactUSFormSchema } from '@/lib/zodSchemas/contact-us-form.schema';

import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';

type TFormData = z.infer<typeof contactUSFormSchema>;

const ContactUsForm = () => {
    const [isFocused, setIsFocused] = useState(false);
    
    const {
        register,
        control,
        formState: {errors}
    } = useForm<TFormData>({
        resolver: zodResolver(contactUSFormSchema)
    })


  return (
    <section>
        <div className="container pt-16 pb-16 md:pb-24 grid place-items-center">
            <form onSubmit={event => event.preventDefault()} className="w-full md:w-[640px] md:px-8">
                <p role="status" className="text-[#667085] text-sm px-3">We can’t receive messages through this form right now. For a question about an existing transaction, sign in and open Support from your account settings.</p>
                <fieldset disabled className="border-0 p-0 m-0 min-w-0">
                <img alt="" src={ContactUsImg} className="object-cover rounded-md md:w-[490px] md:h-[333px] w-full h-[233px] mx-auto" />
                <div className="md:p-12 max-md:mt-10">

                {/* Form inputs */}
                    <div className="mt-10 md:mt-12">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="w-full">
                                <label className="text-[#344054] text-sm font-medium" htmlFor="contact-firstname">First name</label>
                                <input id="contact-firstname" {...register("firstname")} type="text" placeholder="First name" className="w-full outline-0 bg-white py-3 px-4 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-2 focus:border-[#112929] transition" />
                                {errors.firstname && <p className="text-red-600 text-sm mt-1">{errors.firstname.message}</p>}
                            </div>
                            <div className="w-full">
                                <label className="text-[#344054] text-sm font-medium" htmlFor="contact-lastname">Last name</label>
                                <input id="contact-lastname" {...register("lastname")} type="text" placeholder="Last name" className="w-full outline-0 bg-white py-3 px-4 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-2 focus:border-[#112929] transition" />
                                {errors.lastname && <p className="text-red-600 text-sm mt-1">{errors.lastname.message}</p>}
                            </div>
                        </div>
                        <div className="w-full mt-6">
                            <label className="text-[#344054] text-sm font-medium" htmlFor="contact-email">Email</label>
                            <input id="contact-email" {...register("email")} type="email" placeholder="Enter your email address" className="w-full outline-0 bg-white py-3 px-4 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-2 focus:border-[#112929] transition" />
                            {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
                        </div>
                        <div className="w-full mt-6">
                            <label className="text-[#344054] text-sm font-medium mb-2" htmlFor="contact-phone">Phone number</label>
                            <Controller
                                name="phone"
                                control={control}
                                render={({field}) => (
                                    <PhoneInput
                                        country={'ng'}
                                        value={field.value}
                                        onChange={field.onChange}
                                        onFocus={() => setIsFocused(true)}
                                        onBlur={() => {
                                            setIsFocused(false)
                                            field.onBlur()}
                                        }
                                        inputProps={{
                                            name: "phone",
                                            id: "contact-phone",
                                            // required: true,
                                        }}
                                        buttonStyle={{ 
                                            borderRadius: "8px 0 0 8px",
                                            border: isFocused ? "1px solid #112929" : "1px solid #D0D5DD",
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
                            {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>}
                        </div>
                        <div className="w-full mt-6">
                            <label className="text-[#344054] text-sm font-medium" htmlFor="contact-message">Message</label>
                            <textarea id="contact-message" {...register("message")} className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] rounded-md mt-2 focus:border-[#112929] transition" />
                        </div>
                        <div className="mt-6 flex items-center">
                            <input {...register("policy")} type="checkbox" id="terms" className="w-4 h-4 accent-[#112929] cursor-pointer" />
                            <label htmlFor="terms" className="text-[#475467] text-sm font-medium ml-2">You agree to our friendly <Link className='underline hover:font-medium transition' to="/privacy-policy">privacy policy.</Link></label>
                        </div>
                        <button type='submit' className="rounded-[8px] py-3 px-5 md:px-[18px] transition text-white bg-[#112929] hover:opacity-75 mt-8 w-full cursor-pointer" disabled>Messaging temporarily unavailable</button>
                    </div>
                </div>
                </fieldset>
            </form>
        </div>
    </section>
  )
}

export default ContactUsForm;