import api from "../axios";

export interface ReferredUser {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  status: "active" | "inactive";
  createdAt: string;
  country?: string;
  username?: string;
  avatar?: string;
}

export interface BonusMilestone {
  _id: string;
  bonusConfigId: string;
  bonusAmount: number;
  earnedAt: string;
  status: "paid" | "pending";
  paidAt?: string;
}

export interface Referral {
  _id: string;
  refereeId: string;
  referredId: ReferredUser;
  userType: "regular" | "vip";
  bonusMilestones: BonusMilestone[];
  createdAt: string;
  updatedAt: string;
  __v: number;
  totalAmount: number;
}

export type ReferralData = {
  referrals: Referral[];
  totalReferralBonusEarned: number;
}[];

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: number;
  hasPrev: number;
};

export type ReferralResponse = {
  data: ReferralData;
  pagination: Pagination;
};

export interface RefereeUser {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  status: "active" | "inactive";
  createdAt: string;
  username?: string;
  avatar?: string;
}

export interface UplineData {
  _id: string;
  refereeId: RefereeUser;
  referredId: string;
  userType: "regular" | "vip";
  bonusMilestones: BonusMilestone[];
  createdAt: string;
  updatedAt: string;
  __v: number;
}


export const getReferrals = async () => {
    const response = await api.get("/referrals");
    return response.data;
}   

export const getUpline = async () => {
    const response = await api.get("/referrals/upline");
    return response.data?.data;
}   