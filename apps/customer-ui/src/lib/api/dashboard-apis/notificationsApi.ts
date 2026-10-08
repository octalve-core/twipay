import { QueryFunction } from "@tanstack/react-query";
import api from "../axios";

export interface NotificationData {
  amount: string | number;
  balance: number;
  reason?: string;
  reference: string;
  transactionType?: string;
  pin?: string;
}

export interface TNotification {
  _id: string;
  type: string; // e.g., "wallet_debit", "wallet_credit", "transaction_success"
  notifiableType: string; // e.g., "User"
  notifiableId: string;
  title: string;
  message: string;
  data: NotificationData;
  read: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  __v: number;
}

export const getAllNotifications = async () => {
    const res = await api.get("/notifications?page=1&limit=100")
    return res.data.data;
}

export const viewNotification: QueryFunction<TNotification[], [_: string, notificationId: number]> = async ({queryKey}) => {
    const [, notificationId] = queryKey;
    const res = await api.get(`/notifications/${notificationId}`)
    return res.data.data;
}

export const markAsRead = async (id: string) => {
    const res = await api.put(`/notifications/${id}/read`)
    return res.data.data;
}