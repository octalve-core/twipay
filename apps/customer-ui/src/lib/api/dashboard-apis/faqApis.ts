import api from "../axios";

export type TFaq = {
  _id: string;
  faqCategoryId: string;
  question: string;
  slug: string;
  answer: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getFaqs = async () => {
    const res = await api.get("/faqs");
    return res.data.data;
}