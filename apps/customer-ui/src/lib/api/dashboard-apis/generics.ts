import api from "../axios";

export type ServiceStatus =
  | "active"
  | "deactivated"
  | "coming-soon";

export interface ServiceInfo {
  status: ServiceStatus;
  message: string | null;
}

export interface ServicesData {
  data: ServiceInfo;
  airtime: ServiceInfo;
  cable_tv: ServiceInfo;
  electricity: ServiceInfo;
  education: ServiceInfo;
  deposit: ServiceInfo;
  internationalairtime: ServiceInfo;
  internationaldata: ServiceInfo;
  giftcard: ServiceInfo;
  hotel: ServiceInfo;
  withdrawal: ServiceInfo;
}


export const getServicesStatus = async () => {
    const res = await api.get("/reference/service-types-status");
    return res.data.data;
}