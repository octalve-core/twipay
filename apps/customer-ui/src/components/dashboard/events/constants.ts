import EventImage from '@/assets/dashboard/event_image.png'
import SelectEvent from './SelectEvent'
import PurchaseDetails from './PurchaseDetails'
import ConfirmEventsBooking from './ConfirmEventsBooking'
import Status from './Status'

export const DummyEventsArray =[
    {
        id: 1,
        image: EventImage,
        name: "5ive listening party",
        desc: "Attend the listening party of Africa’s biggest album drop of the year: 5ive by Davido. The artiste drops his 5th studio album.",
        location: "Lagos",
        email: "Partner@5ive.ng",
        amount: 16500
    },
    {
        id: 2,
        image: EventImage,
        name: "5ive listening party",
        desc: "Attend the listening party of Africa’s biggest album drop of the year: 5ive by Davido. The artiste drops his 5th studio album.",
        location: "Lagos",
        email: "Partner@5ive.ng",
        amount: 16500
    },
    {
        id: 3,
        image: EventImage,
        name: "5ive listening party",
        desc: "Attend the listening party of Africa’s biggest album drop of the year: 5ive by Davido. The artiste drops his 5th studio album.",
        location: "Lagos",
        email: "Partner@5ive.ng",
        amount: 16500
    },
    {
        id: 4,
        image: EventImage,
        name: "5ive listening party",
        desc: "Attend the listening party of Africa’s biggest album drop of the year: 5ive by Davido. The artiste drops his 5th studio album.",
        location: "Lagos",
        email: "Partner@5ive.ng",
        amount: 16500
    },
]

export const EventsSteps = [
    {
        id: 1,
        component: SelectEvent
    },
    {
        id: 2,
        component: PurchaseDetails
    },
    {
        id: 3,
        component: ConfirmEventsBooking
    },
    {
        id: 4,
        component: Status
    },
]