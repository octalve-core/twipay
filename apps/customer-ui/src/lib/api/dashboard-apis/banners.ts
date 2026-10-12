import api from "../axios";

export interface TBanner {
  _id: string;
  previewImageUrl: string;
  featuredImageUrl: string;
  creator: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  __v: number;
  isActive: boolean;
}


export const getBanners = async () => {
    const res = await api.get("/reference/banners");
    return res.data.data;
}