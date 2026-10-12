export const FlightTicketTypes = [
    {
        id: 1,
        value: "one_way",
        label: "One-way trip"
    },
    {
        id: 2,
        value: "round_trip",
        label: "Round trip"
    },
  ] as const

  export const LocalAirports = [
    {
        id: 1,
        name: "Lagos (LOS): Murtala Muhammed International Airport",
    },
    {
        id: 2,
        name: "Abuja (ABV): Nnamdi Azikiwe International Airport",
    },
    {
        id: 3,
        name: "Kano (KAN): Mallam Aminu Kano International Airport"
    },
    {
        id: 4,
        name: "Port Harcourt (PHC): Port Harcourt International Airport"
    },
    {
        id: 5,
        name: "Calabar (CBQ): Margaret Ekpo International Airport"
    },
  ]

  export const FlightTypes = [
    {
        id: 1,
        label: "Business"
    },
    {
        id: 2,
        label: "First Class"
    },
    {
        id: 3,
        label: "Economy"
    },
    {
        id: 4,
        label: "Charter flights"
    },
    {
        id: 5,
        label: "Cargo aircraft"
    },
    {
        id: 6,
        label: "Connecting flights"
    },
    {
        id: 7,
        label: "Premium Economy"
    },
    {
        id: 8,
        label: "Military aircraft"
    },
    {
        id: 9,
        label: "Airliner"
    },
  ]

  export const PassengerTypes = [
    {
        id: 1,
        name: "Adult"
    },
    {
        id: 2,
        name: "Child"
    },
    {
        id: 3,
        name: "Infant"
    },
  ]

  import AirlineLogo from "@/assets/dashboard/airline.svg"

 export const DummyAirlineArray = [
    {
        id: 1,
        name: "Green Africa’s flight details",
        price: "1,650,000",
        takeOffTime: "08:20",
        takeOffLocation: "LAG",
        arrivalTime: "18:00",
        arrivalLocation: "SD",
        logo: AirlineLogo,
    },
    {
        id: 2,
        name: "Green Africa’s flight details",
        price: "1,650,000",
        takeOffTime: "08:20",
        takeOffLocation: "LAG",
        arrivalTime: "18:00",
        arrivalLocation: "SD",
        logo: AirlineLogo,
    },
    {
        id: 3,
        name: "Green Africa’s flight details",
        price: "1,650,000",
        takeOffTime: "08:20",
        takeOffLocation: "LAG",
        arrivalTime: "18:00",
        arrivalLocation: "SD",
        logo: AirlineLogo,
    },
    {
        id: 4,
        name: "Green Africa’s flight details",
        price: "1,650,000",
        takeOffTime: "08:20",
        takeOffLocation: "LAG",
        arrivalTime: "18:00",
        arrivalLocation: "SD",
        logo: AirlineLogo,
    },
]