import { z } from 'zod';

export const contactUSFormSchema = z.object({
    firstname: z.string().min(2, "Minimum of two characters"),
    lastname: z.string().min(2, "Minimum of two characters"),
    email: z.string().email("Please input a valid email address"),
    message: z.string().optional(),
    phone: z.string().min(10, "Please input a valid phone number").nonempty("Please input a valid phone number"),
    policy: z.literal(true).refine(val => val === true, {
        message: "You must accept the policy"
    })
})