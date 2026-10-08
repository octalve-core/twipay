import { PassengerFormData } from "@/stores/useFlightStore";
import api from "../axios";

export type TAirlines = {
    id: number,
    name: string,
    code: string,
    logo: string
}

type TCityCountry = {
  id: number;
  name: string;
  code: string;
  iso2: string;
  iso3: string;
  phone_code: string;
  region: string;
  emoji: string;
  emoji_code: string;
  capital: string;
  currency: string;
  currency_name: string;
  currency_symbol: string;
  longitude: string;
  latitude: string;
  flag_url: string;
  can_do_airtime: boolean;
  airtime_activated_at: string | null;
  created_at: string;
};

export type TCity = {
  id: number;
  country_id: number;
  name: string;
  code: string;
  longitude: number;
  latitude: number;
  created_at: string;
  full_name: string;
  country: TCityCountry;
};


export const getAirlines = async () => {
    const res = await api.get("/flights/airlines")
    return res.data.data;
}

export const searchCities = async (searchWord: string) => {
    const res = await api.get(`/flights/cities?search=${searchWord}`)
    return res.data.data;
}

export const getFlightClasses = async () => {
    const res = await api.get("/flights/classes")
    return res.data.data;
}

export interface FlightData {
  id: string;
  departure_from: string;
  arrival_to: string;
  trip_type: string;
  currency: string;
  price: string;
  price_breakdown: {
    passenger_1: string;
    total: string;
  };
  passengers: Passenger[];
  itineraries: {
    to: Itinerary[];
    fro: Itinerary[] | undefined;
  };
}

export interface Passenger {
  id: string;
  type: "adult" | "child" | "held_infant";
  price: string;
  currency: string;
}

interface Itinerary {
  depart_from: string;
  departing_terminal: string | null;
  depart_at: DateFormat;
  arrive_in: string;
  arrival_terminal: string | null;
  arrive_at: DateFormat;
  itinerary_duration: string; // ISO 8601 duration like "PT4H30M"
  airline: TAirline | string;
  aircraft: string;
}

interface DateFormat {
  one: string;   // e.g., "2025-10-10"
  two: string;   // e.g., "2025-10-10 15:00:00"
  three: string; // e.g., "Fri, Oct 10, 2025 3:00 PM"
  four: string;  // e.g., "4 months from now"
}

export interface TAirline {
  name: string;
  code: string;
  logo: string;
}


type TParams = {
  trip_type: "one_way" | "round_trip";
  from: string;
  to: string;
  departure_date: string;
  return_date?: string;
  flight_class: string;
  adult_count: string;
  infant_count: string;
  children_count: string;
}

export const getFlightOffers = async (params: TParams) => {
  const queryParams: Record<string, string | number | undefined> = {
      trip_type: params.trip_type,
      from: params.from,
      to: params.to,
      departure_date: params.departure_date,
      return_date: params.return_date,
      flight_class: params.flight_class,
      adult_count: params.adult_count,
}

  if (params.return_date) queryParams["return_date"] = params.return_date;
  if (parseInt(params.infant_count) > 0) queryParams["infant_count"] = params.infant_count;
  if (parseInt(params.children_count) > 0) queryParams["children_count"] = params.children_count;

  const res = await api.get("/flights/offers", {
    params: queryParams
  })
  return res.data;
}

type TBookFlightParams = {
  offer_id: string;
  passengers: PassengerFormData[];
}

export const bookFlight = async (bookFlightParams: TBookFlightParams) => {
  const response = await api.post("/flights/book", bookFlightParams);
  return response.data
}