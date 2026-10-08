import { ChangePasswordFormSchema } from "@/lib/zodSchemas/dashboard.schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import EnterPasswordInput from "./EnterPasswordInput"
import CustomButton from "@/components/CustomButton"

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AxiosError } from "axios";
import { changePassword } from "@/lib/api/dashboard-apis/settingsApis";

type TFormData = z.infer<typeof ChangePasswordFormSchema>

type TChangePasswordForm = {
    closeModal: () => void;
    disableBackButton: (value: boolean) => void; //To disable back button
}

const ChangePasswordForm = ({closeModal, disableBackButton}: TChangePasswordForm) => {

    const {
        register,
        handleSubmit,
        formState: {errors}
    } = useForm<TFormData>({
        resolver: zodResolver(ChangePasswordFormSchema)
    }) 

    const {mutate: changePasswordFn, isPending: isChangingPassword} = useMutation({
        mutationFn: changePassword,
        onSuccess: () => {
            toast.success("Password changed successfully!")
            
            closeModal();
            disableBackButton(false);
        },
        onError: (error: AxiosError) => {
            disableBackButton(false);

            const errData = error.response?.data as { message?: string };
            if(errData.message){
                return toast.error(errData.message)
            }
            toast.error("Something went wrong, please try again")
        }
        
    })

    const onSubmit = (data: TFormData) => {
        disableBackButton(true);
        changePasswordFn({old_password: data.currentPassword, password: data.newPassword})
    }


  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
        <EnterPasswordInput label="Current password" name="currentPassword" register={register} errors={errors} placeholder="enter your current password" />
        <EnterPasswordInput label="New password" name="newPassword" register={register} errors={errors} placeholder="enter your new password" />
        <EnterPasswordInput label="Confirm password" name="confirmPassword" register={register} errors={errors} placeholder="re-enter your new password" />
        <CustomButton isLoading={isChangingPassword} disabled={isChangingPassword}>Save</CustomButton>
    </form>
  )
}

export default ChangePasswordForm