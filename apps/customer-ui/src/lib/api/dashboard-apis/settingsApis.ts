import { verifyBankAccountPayload } from "@/components/dashboard/settings/AddNewBank";
import api from "../axios";

export const changePassword = async ({old_password, password}: {old_password: string; password: string;}) => {
    const res = await api.post("/auth/change-password", {oldPassword: old_password, newPassword: password})
    return res.data;
}

export const send2faCode = async (payload: {email: string}) => {
    const res = await api.post("/auth/2fa/resend", payload)
    return res.data;
}

export const toggle2fa = async ({enable}: {enable: boolean}) => {
    const res = await api.post("/auth/2fa/toggle", {enable})
    return res.data;
}

export const getSavedAccounts = async () => {
    const res = await api.get("/bank-accounts");
    return res.data.data;
}

export const verifyBankAccount = async (payload: verifyBankAccountPayload) => {
    const res = await api.post("/bank-accounts/verify", payload)
    return res.data.data;
}

export const addBankAccount = async (payload: {bankCode: string; accountName: string; accountNumber: string;}) => {
    const res = await api.post("/bank-accounts", payload)
    return res.data.data;
}

export interface ImageKitAuthResponse {
  signature: string;
  token: string;
  expire: number;
  publicKey: number;
}

export interface UploadImageResponse {
  fileId: string;
  name: string;
  size: number;
  versionInfo: {
    id: string;
    name: string;
  };
  filePath: string;
  url: string;
  fileType: "image" | "video" | "raw";
  height: number;
  width: number;
  thumbnailUrl: string;
  description: string | null;
}

// Image upload
export async function uploadToImageKit(file: File): Promise<UploadImageResponse> {
  // 1. Get signature from your backend
  const { data } = await api.get<ImageKitAuthResponse>("/media/signature");

  const { signature, token, expire, publicKey } = data;

  (void 0)

  // 2. Prepare FormData for ImageKit upload endpoint
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);
  formData.append("signature", signature);
  formData.append("token", token);
  formData.append("expire", String(expire));
  formData.append("publicKey", import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY);

  // 3. Upload to ImageKit
  const uploadResponse = await api.post(
    "https://upload.imagekit.io/api/v1/files/upload",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" }
    }
  );

  return uploadResponse.data;
}

export const updateProfileImage = async (payload: {avatar: string}) => {
    const res = await api.put("/profile/avatar", payload)
    return res.data.data;
}