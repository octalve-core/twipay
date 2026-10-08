import { z } from "zod";

// Transfer funds
export const TransferFundsSchema = z.object({
    user: z.string().min(2, "please enter recipients username or phone number"),
    amount: z.string().min(2, "please enter a valid amount"),
    note: z.string().optional()
})

// Withdraw funds
export const WithdrawalAmountFormSchema = z.object({
    amount: z.string().min(2, "please enter a valid amount"),
    note: z.string().optional()
})

export const RecipientDetailFormSchema = z.object({
    account_no: z.string().min(7, "please enter a valid account number"),
    amount: z.string().min(2, "please enter a valid amount"),
})

// Add funds
export const AddFundsAmountFormSchema = z.object({
    amount: z.string().min(2, "please enter a valid amount"),
})

// Static account
export const CreateStaticAccountForm =z.object({
    fullname: z.string().min(2, "please enter your full name"),
    bvn: z.string().min(11, "please enter a valid BVN").max(11, "please enter a valid BVN"),
    accept_terms: z.boolean().optional()
})

// Services - Airtime
export const AirtimeRecipientDetailFormSchema = z.object({
    phone: z.string().min(10, "Please input a valid phone number").nonempty("Please input a valid phone number"),
    amount: z
        .string()
        .refine(val => Number(val) >= 50, {
            message: "Amount must be at least ₦50",
    }),
})

// Services - Data
export const DataRecipientDetailFormSchema = z.object({
    phone: z.string().min(10, "Please input a valid phone number").nonempty("Please input a valid phone number"),
})

// Services - electricity
export const ElectricityFormSchema = z.object({
    meterNumber: z.string().min(11, "Please input the correct meter number").nonempty("Please input the correct meter number"),
    quantity: z
        .string()
        .refine(val => Number(val) >= 1000, {
            message: "Amount must be at least ₦1,000",
    }),
})

// Services - betting
export const BettingServiceFormSchema = z.object({
    amount: z
        .string()
        .refine(val => Number(val) >= 100, {
            message: "Amount must be at least ₦100",
    }),
    user: z.string().min(4, "please enter the correct user id"),
})

// Services - TV/Cable
export const TVCableFormSchema = z.object({
    smartcardNo: z.string().min(2, "please enter the correct smartcard number"),
})

// Services - EPIN
export const EpinFormSchema = z.object({
    examNumber: z.string().min(2, "please enter the correct exam number"),
})

// Services - ESIM
export const ESimFormSchema = z.object({
    validity: z.string().min(2, "select validity"),
})

// Services - Mobile money payment
export const MobileMoneySchema = z.object({
    provider: z.string().min(2, "select a provider"),
    wallet_no: z.string().min(2, "Enter the correct wallet number"),
    amount: z.string().min(2, "please enter a valid amount"),
})

// Services - Flight Passenger info
export const PassengerInfoFormSchema = z.object({
    firstname: z.string().min(2, "Minimum of 2 characters"),
    lastname: z.string().min(2, "Minimum of 2 characters"),
    email: z.string().email("Please input a valid email address"),
    phone: z.string().min(10, "Please input a valid phone number").nonempty("Please input a valid phone number"),
    gender: z.string(),
})

// Services - Events
export const EventsFormSchema = z.object({
    fullname: z.string().min(2, "Minimum of 2 characters"),
    email: z.string().email("Please input a valid email address"),
    phone: z.string().min(10, "Please input a valid phone number").nonempty("Please input a valid phone number"),
})

// Services - Hotel Booking - Customer info
export const CustomerInfoFormSchema = z.object({
    firstname: z.string().min(2, "Minimum of 2 characters"),
    middlename: z.string().min(2, "Minimum of 2 characters"),
    lastname: z.string().min(2, "Minimum of 2 characters"),
    phone: z.string().min(10, "Please input a valid phone number").nonempty("Please input a valid phone number"),
    note: z.string().optional(),
})

// Services - International Airtime
export const IntAirtimeRecipientDetailFormSchema = z.object({
    phone: z.string().min(10, "Please input a valid phone number").nonempty("Please input a valid phone number"),
    amount: z
        .string()
        .refine(val => Number(val) >= 50, {
            message: "Amount must be at least ₦50",
    }),
})

// Services - International Data
export const IntDataRecipientDetailFormSchema = z.object({
    phone: z.string().min(10, "Please input a valid phone number").nonempty("Please input a valid phone number"),
})

// ****************** SETTINGS ***************

// Account settings schema
export const AccountSettingsFormSchema = z.object({
    firstname: z.string().min(2, "Minimum of two characters"),
    lastname: z.string().min(2, "Minimum of two characters"),
    email: z.string().email("Please input a valid email address"),
    username: z.string().min(2, "Minimum of two characters"),
    country: z.string(),
    state: z.string(),
})

// Change password form
export const ChangePasswordFormSchema = z.object({
    currentPassword: z.string().min(8, "Password must be at least 8 characters long"),
    newPassword: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters long"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
})

//Update bank Info
export const UpdateBankInfoFormSchema = z.object({
    accountNumber: z.string().min(2, "enter the correct account number")
})

// SupportForm
export const SupportFormSchema = z.object({
    email: z.string().email("Please input a valid email address"),
    username: z.string().min(2, "Minimum of two characters"),
    message: z.string().min(2, "enter the message you want to send"),
})

// Virtual Card withdraw
export const CardWithdrawFormSchema = z.object({
    bank: z.string(),
    account_no: z.string().min(7, "please enter a valid account number"),
    amount: z.string().min(2, "please enter a valid amount"),
})