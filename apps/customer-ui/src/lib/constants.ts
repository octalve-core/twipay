import Layers from "../assets/main-pages/Layers.png";
import Sisyphus from "../assets/main-pages/sisyphus.png";
import Circooles from "../assets/main-pages/circooles.png";
import Catalog from "../assets/main-pages/catalog.png";
import Quotient from "../assets/main-pages/quotient.png";

import Bills from "../assets/main-pages/bills.png";
import Referrals from "../assets/main-pages/referrals.png";
import StaticAccount from "../assets/main-pages/static_account.png";
import VirtualCard from "../assets/main-pages/virtual_cards.png";

import Users from "../assets/main-pages/users.svg";
import Chart from "../assets/main-pages/chart.svg";
import Fast from "../assets/main-pages/fast.svg";
import Flag from "../assets/main-pages/flag.svg";
import Heart from "../assets/main-pages/heart.svg";
import Smiley from "../assets/main-pages/smiley.svg";

import MailIcon from "@/assets/main-pages/mail_icon.png";

import Link from "@/assets/dashboard/link.svg";
import Division from "@/assets/dashboard/division.svg";
import Receipt from "@/assets/dashboard/receipt.svg";
import AvatarGroup from "@/assets/dashboard/Avatar Groups.png";

import { GoHome } from "react-icons/go";
import { LuBriefcase } from "react-icons/lu";
import { FaRegFileLines } from "react-icons/fa6";
import { VscGift } from "react-icons/vsc";
import { RiSettings2Line } from "react-icons/ri";
import { LuSend } from "react-icons/lu";
import { LuDownload, LuPlus } from "react-icons/lu";
import { IoIosAddCircleOutline } from "react-icons/io";

import Virtual from "@/assets/dashboard/virtual.svg";
import Flutterwave from "@/assets/dashboard/flutter.svg";
import OpayIcon from "@/assets/dashboard/opay.svg";

import MtnIcon from "@/assets/dashboard/mtn.svg";
import AirtelIcon from "@/assets/dashboard/airtel.svg";
import nineMobile from "@/assets/dashboard/9mobile.svg";
import glo from "@/assets/dashboard/globacom.svg";

import { LuBell, LuBookOpenText, LuLink, LuMail } from "react-icons/lu";

// NAVBAR
export const navlinks = [
  {
    id: 1,
    label: "Home",
    href: "/",
  },
  {
    id: 2,
    label: "About us",
    href: "/about",
  },
  // {
  //     id: 4,
  //     label: "Privacy Policy",
  //     href:"/privacy-policy"
  // },
  // {
  //     id: 6,
  //     label: "Terms & Conditions",
  //     href:"/terms"
  // },
];

// EXTERNAL PAGES
export const partnerships = [
  {
    id: 1,
    image: Layers,
    width: 146,
  },
  {
    id: 2,
    image: Sisyphus,
    width: 169,
  },
  {
    id: 3,
    image: Circooles,
    width: 183,
  },
  {
    id: 4,
    image: Catalog,
    width: 160,
  },
  {
    id: 5,
    image: Quotient,
    width: 187,
  },
];

export const features = [
  {
    id: 1,
    image: Bills,
    title: "Seamless bill payment.",
    description:
      "Browse everyday services and check available products in one familiar place. Purchases are offered when the service is available.",
  },
  {
    id: 2,
    image: StaticAccount,
    title: "Get static account.",
    description:
      "See assigned funding-account details and track your account status alongside your TwiPay wallet.",
  },
  {
    id: 3,
    image: Referrals,
    title: "Refer to earn.",
    description:
      "Share what you enjoy with friends when referrals become available.",
  },
  {
    id: 4,
    image: VirtualCard,
    title: "Virtual card that works.",
    description:
      "Keep more ways to pay on your horizon. Card services are not yet available.",
  },
];

export const whyUseDataarena = [
  {
    id: 1,
    icon: Users,
    title: "Care about our customers",
    content:
      "Understand what matters to our users. Give them what they need to do solve their needs.",
  },
  {
    id: 2,
    icon: Heart,
    title: "Excellent customer service",
    content:
      "We’re working to make account information clear and easy to find.",
  },
  {
    id: 3,
    icon: Chart,
    title: "Pride in what we do",
    content:
      "Value quality and integrity in everything we do. At all times. No exceptions.",
  },
  {
    id: 4,
    icon: Smiley,
    title: "Happy customer reviews",
    content:
      "We want every experience to be one worth recommending.",
  },
  {
    id: 5,
    icon: Flag,
    title: "No red flags",
    content:
      "You should always know what you are reviewing before confirming a payment.",
  },
  {
    id: 6,
    icon: Fast,
    title: "Fast and reliable service",
    content:
      "Our platform is designed to process your  transactions quickly and accurately.",
  },
];

export const faqsContent = [
  {id: 1, question: "Where can I view my transactions?", answer: "Sign in and open Transaction History to review payments and their current status."},
  {id: 2, question: "How do I check my balance?", answer: "Your dashboard shows your available wallet balance when your account details can be loaded."},
  {id: 3, question: "What if a payment is still processing?", answer: "Check its status in Transaction History before trying another payment."},
  {id: 4, question: "How can I verify my identity?", answer: "Open Identity Verification in your account settings and follow the available steps."},
];

export const faqCards = [
  {
    id: 1,
    icon: MailIcon,
    question: "How do I change my account email?",
    answer:
      "You can change the email address associated with your account by going to untitled.com/account from a laptop or desktop.",
  },
  {
    id: 2,
    icon: MailIcon,
    question: "How do I change my account email?",
    answer:
      "You can change the email address associated with your account by going to untitled.com/account from a laptop or desktop.",
  },
  {
    id: 3,
    icon: MailIcon,
    question: "How do I change my account email?",
    answer:
      "You can change the email address associated with your account by going to untitled.com/account from a laptop or desktop.",
  },
  {
    id: 4,
    icon: MailIcon,
    question: "How do I change my account email?",
    answer:
      "You can change the email address associated with your account by going to untitled.com/account from a laptop or desktop.",
  },
  {
    id: 5,
    icon: MailIcon,
    question: "How do I change my account email?",
    answer:
      "You can change the email address associated with your account by going to untitled.com/account from a laptop or desktop.",
  },
  {
    id: 6,
    icon: MailIcon,
    question: "How do I change my account email?",
    answer:
      "You can change the email address associated with your account by going to untitled.com/account from a laptop or desktop.",
  },
];

// DASHBOARD
export const dashboardLinks = [
  {
    id: 1,
    label: "Dashboard",
    link: "/dashboard",
    subCategories: null,
    icon: GoHome,
  },
  {
    id: 2,
    label: "Services",
    link: "/dashboard/services",
    subCategories: [
      {
        id: 1,
        label: "Airtime",
        href: "/dashboard/services/airtime",
      },
      {
        id: 2,
        label: "Data",
        href: "/dashboard/services/data",
      },
      {
        id: 3,
        label: "Electricity",
        href: "/dashboard/services/electricity",
      },
      {
        id: 5,
        label: "TV/Cable",
        href: "/dashboard/services/cable",
      },
      {
        id: 6,
        label: "E-PIN",
        href: "/dashboard/services/epin",
      },
      {
        id: 7,
        label: "E-Sim",
        href: "/dashboard/services/esim",
      },
    ],
    icon: LuBriefcase,
  },
  {
    id: 3,
    label: "History",
    link: "/dashboard/history",
    subCategories: null,
    icon: FaRegFileLines,
  },
  {
    id: 4,
    label: "Affiliate",
    link: "/dashboard/affiliate",
    subCategories: null,
    icon: VscGift,
  },
  {
    id: 5,
    label: "Settings",
    link: "/dashboard/settings",
    subCategories: null,
    icon: RiSettings2Line,
  },
];

export const quickActions = [
  {
    id: 1,
    label: "Transfer Funds",
    href: "/dashboard/transfer-funds",
    icon: LuSend,
  },
  {
    id: 2,
    label: "Withdraw Funds",
    href: "/dashboard/withdraw-funds",
    icon: LuDownload,
  },
  {
    id: 3,
    label: "Add Funds",
    href: "/dashboard/add-funds",
    icon: LuPlus,
  },
  {
    id: 4,
    label: "Static Account",
    href: "/dashboard/static-account",
    icon: IoIosAddCircleOutline,
  },
];

export const otherServices = [
  {
    id: 1,
    href: "/dashboard/events",
    icon: Link,
    label: "Events Tickets",
    bgColor: "#FEF6E7",
  },
  {
    id: 2,
    href: "/dashboard/hotels",
    icon: Division,
    label: "Hotel Booking",
    bgColor: "#FCDAEE",
  },
  {
    id: 3,
    href: "/dashboard/book-flight",
    icon: Receipt,
    label: "Flight Booking",
    bgColor: "#E7F6EC",
  },
  {
    id: 4,
    href: "/dashboard/affiliate",
    icon: AvatarGroup,
    label: "Invite and earn",
    bgColor: "#E3EFFC",
  },
];

import RocketIcon from "@/assets/dashboard/rocket-mobile.svg";
import BriefCaseIcon from "@/assets/dashboard/briefcase-mobile.svg";
import CardIcon from "@/assets/dashboard/credit-card-mobile.svg";
import HomeIcon from "@/assets/dashboard/home-mobile.svg";
import RadioIcon from "@/assets/dashboard/radio-mobile.svg";

export const otherServicesMobile = [
  {
    id: 1,
    href: "/dashboard/book-flight",
    title: "Book flights",
    subTitle: "Book one way or round flight trips.",
    icon: RocketIcon,
  },
  {
    id: 2,
    href: "/dashboard/events",
    title: "Events",
    subTitle: "Pay event bills.",
    icon: BriefCaseIcon,
  },
  {
    id: 3,
    href: "/dashboard/virtual-card",
    title: "Virtual cards",
    subTitle: "Create and manage a virtual card.",
    icon: CardIcon,
  },
  {
    id: 4,
    href: "/dashboard/hotels",
    title: "Hotel booking",
    subTitle: "Book hotel rooms easily.",
    icon: HomeIcon,
  },
  {
    id: 5,
    href: "/dashboard/services/mobile-money",
    title: "Payment",
    subTitle: "Make mobile payments easily.",
    icon: RadioIcon,
  },
];

import Rss from "@/assets/dashboard/rss.svg";
import Globe from "@/assets/dashboard/globe.svg";
import Zap from "@/assets/dashboard/zap.svg";
import Tv from "@/assets/dashboard/tv.svg";
import Key from "@/assets/dashboard/key.svg";
import Radio from "@/assets/dashboard/radio.svg";
import Phone from "@/assets/dashboard/smartphone.svg";
import BriefCase from "@/assets/dashboard/briefcase.svg";
import Rocket from "@/assets/dashboard/rocket.svg";
import Home from "@/assets/dashboard/home.svg";
import Card from "@/assets/dashboard/credit-card.svg";

export const appServices = [
  {
    id: 1,
    label: "Airtime",
    icon: Rss,
    href: "/dashboard/services/airtime",
  },
  {
    id: 2,
    label: "Data",
    icon: Globe,
    href: "/dashboard/services/data",
  },
  {
    id: 3,
    label: "Electricity",
    icon: Zap,
    href: "/dashboard/services/electricity",
  },
  {
    id: 5,
    label: "TV/Cable",
    icon: Tv,
    href: "/dashboard/services/cable",
  },
  {
    id: 6,
    label: "E-PIN",
    icon: Key,
    href: "/dashboard/services/epin",
  },
  {
    id: 7,
    label: "E-Sim",
    icon: Radio,
    href: "/dashboard/services/esim",
  },
  {
    id: 8,
    label: "Payment",
    icon: Phone,
    href: "/dashboard/services/mobile-money",
  },
  {
    id: 9,
    label: "Events",
    icon: BriefCase,
    href: "/dashboard/events",
  },
  {
    id: 10,
    label: "Flights",
    icon: Rocket,
    href: "/dashboard/book-flight",
  },
  {
    id: 11,
    label: "Hotels",
    icon: Home,
    href: "/dashboard/hotels",
  },
  {
    id: 12,
    label: "Card",
    icon: Card,
    href: "/dashboard/virtual-card",
  },
  {
    id: 13,
    label: "International Airtime",
    icon: Rss,
    href: "/dashboard/services/international-airtime",
  },
  {
    id: 14,
    label: "International Data",
    icon: Globe,
    href: "/dashboard/services/international-data",
  },
];

export const paymentMethods = [
  {
    id: "virtual",
    label: "Virtual Account",
    icon: Virtual,
    bank_name: "Virtual bank",
    account_number: "",
    account_name: "",
  },
  {
    id: "opay",
    label: "Opay",
    icon: OpayIcon,
    bank_name: "Opay Digital Services",
    account_number: "",
    account_name: "",
  },
  {
    id: "flutter",
    label: "Flutterwave",
    icon: Flutterwave,
    bank_name: "Flutterwave",
    account_number: "",
    account_name: "",
  },
] as const;

export const NetworkProviders = [
  {
    id: 1,
    name: "mtn",
    logo: MtnIcon,
  },
  {
    id: 2,
    name: "airtel",
    logo: AirtelIcon,
  },
  {
    id: 3,
    name: "9mobile",
    logo: nineMobile,
  },
  {
    id: 4,
    name: "globacom",
    logo: glo,
  },
];

import Glodropdown from "@/assets/dashboard/glo-dropdown.png";
import Mtndropdown from "@/assets/dashboard/mtn-dropdown.png";
import Airteldropdown from "@/assets/dashboard/airtel-dropdown.png";
import nineMobiledropdown from "@/assets/dashboard/9mobile-dropdown.png";

export const NetworkProvidersDropdown = [
  {
    label: "Glo",
    logo: Glodropdown,
    textColor: "#066006",
    value: "glo",
  },
  {
    label: "MTN",
    logo: Mtndropdown,
    textColor: "#B8AA2C",
    value: "mtn",
  },
  {
    label: "9mobile",
    logo: nineMobiledropdown,
    textColor: "#008000",
    value: "9mobile",
  },
  {
    label: "Airtel",
    logo: Airteldropdown,
    textColor: "#FF0000",
    value: "airtel",
  },
];

export const settingsData = [
  {
    id: 1,
    title: "Account",
    path: "account",
    subTitle: "View and make changes to your account",
    hasVerifiedTag: false,
    icon: LuMail,
  },
  {
    id: 6,
    title: "Identity verification",
    path: "identity-verification",
    subTitle: "Verify your BVN or NIN",
    hasVerifiedTag: false,
    icon: LuMail,
  },
  {
    id: 2,
    title: "Account security",
    path: "security-overview",
    subTitle: "Security options for your account",
    hasVerifiedTag: false,
    icon: LuBell,
  },
  {
    id: 3,
    title: "Bank info",
    path: "bank-info",
    subTitle: "Bank accounts connected to your TwiPay account",
    hasVerifiedTag: false,
    icon: LuLink,
  },
  {
    id: 4,
    title: "Help centre",
    path: "support-centre",
    subTitle: "Find answers and get payment support",
    hasVerifiedTag: false,
    icon: LuBookOpenText,
  },
  {
    id: 8,
    title: "Saved beneficiaries",
    path: "beneficiaries",
    subTitle: "Your saved payment recipients",
    hasVerifiedTag: false,
    icon: LuLink,
  },
  {
    id: 9,
    title: "Notification preferences",
    path: "notification-preferences",
    subTitle: "Choose how you receive account updates",
    hasVerifiedTag: false,
    icon: LuBell,
  },
  {
    id: 11,
    title: "My tickets",
    path: "/dashboard/my-tickets",
    subTitle: "View your event bookings",
    hasVerifiedTag: false,
    icon: LuBookOpenText,
  },
  {
    id: 12,
    title: "Organizer centre",
    path: "/dashboard/organizer",
    subTitle: "See your organizer profiles and events",
    hasVerifiedTag: false,
    icon: LuBriefcase,
  },
];

import { isPathUnderAnyPrefix } from "./routePath";

// Batch A: originals remain in source; unavailable capabilities are not published as active flows.
// Betting is excluded permanently by business decision; never enable it via feature flags.
export const removedProductRoutes = ["/dashboard/services/betting"] as const;
export const futureProductRoutes = [
  "/dashboard/services/epin", "/dashboard/services/international-airtime",
  "/dashboard/services/international-data", "/dashboard/services/esim",
  "/dashboard/services/mobile-money", "/dashboard/virtual-card",
  "/dashboard/book-flight", "/dashboard/flight", "/dashboard/airline",
  "/dashboard/hotels", "/dashboard/hotel",
  "/dashboard/referral", "/dashboard/affiliate",
  // Email-to-user transfers have no server-enforced TwiPay ledger contract yet.
  "/dashboard/transfer-funds",
] as const;
export const isDeferredOrExcludedRoute = (path: string): boolean =>
  isPathUnderAnyPrefix(path, [...removedProductRoutes, ...futureProductRoutes]);
export const activeQuickActions = quickActions.filter((entry) => !isDeferredOrExcludedRoute(entry.href));
export const activeDashboardLinks = dashboardLinks
  .filter((entry) => !isDeferredOrExcludedRoute(entry.link))
  .map((entry) => ({ ...entry, subCategories: entry.subCategories?.filter((item) => !isDeferredOrExcludedRoute(item.href)) ?? null }));
export const activeAppServices = appServices.filter((service) => !isDeferredOrExcludedRoute(service.href));

export const activeOtherServices = otherServices.filter((entry) => !isDeferredOrExcludedRoute(entry.href));
export const activeOtherServicesMobile = otherServicesMobile.filter((entry) => !isDeferredOrExcludedRoute(entry.href));

// Unverified legacy referral/card marketing claims are held back pending launch review.
export const activeMarketingFeatures = features.filter((item) => item.id !== 3 && item.id !== 4);
