import { z } from "zod";

export const signUpFormSchema = z.object({
    firstname: z.string().min(2, "Minimum of two characters"),
    lastname: z.string().min(2, "Minimum of two characters"),
    email: z.string().email("Please input a valid email address"),
    password: z.string().min(12, "Password must be at least 12 characters long"),
    referralCode: z.string().optional(),
})

export const verifyPhoneNumberSchema = z.object({
    phone: z.string().min(10, "Please input a valid phone number").nonempty("Please input a valid phone number"),
    code: z.string().nonempty("Please input a valid code"),
})

export const userDetailsFormSchema = z.object({
    username: z.string().min(2, "Minimum of two characters"),
    gender: z.string(),
})

export const logInFormSchema = z.object({
    email: z.string().email("Please input a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
})

export const verifyEmailSchema = z.object({
    email: z.string().email("Please input a valid email address"),
    code: z.string().nonempty("Please input a valid code"),
})

export const createNewPasswordFormSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters long"),
}).refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
})