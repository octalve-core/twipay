import {
  createBrowserRouter,
  RouterProvider,
  useLocation,
  Navigate,
} from "react-router-dom";

import { Toaster } from 'sonner';


import { isDeferredOrExcludedRoute } from "./lib/constants";
import AuthenticatedCustomerRoute from "./routes/layout/AuthenticatedCustomerRoute";
import MfaChallengeRoute from "./routes/layout/MfaChallengeRoute";
import Homepage from "./routes/external-pages/Homepage";
import About from "./routes/external-pages/About";
import MainLayout from "./routes/layout/MainLayout";
import ContactPage from "./routes/external-pages/ContactPage";
import Faq from "./routes/external-pages/Faq";
import PrivacyPolicy from "./routes/external-pages/PrivacyPolicy";
import TermsPage from "./routes/external-pages/TermsPage";
import Guide from "./routes/external-pages/Guide";

import AuthLayout from "./routes/layout/AuthLayout";
import VerifyPhone from "./routes/auth-pages/VerifyPhone";
import UserDetails from "./routes/auth-pages/UserDetails";
import VerifyEmail from "./routes/auth-pages/VerifyEmail";
import SetTransactionPin from "./routes/auth-pages/SetTransactionPin";
import ResetPassword from "./routes/auth-pages/ResetPassword";
import SignUp from "./routes/auth-pages/SignUp";
import Login from "./routes/auth-pages/LogIn";
import GoogleComplete from "./routes/auth-pages/GoogleComplete";

import AccountSecurityOverview from "./routes/dashboard/foundations/AccountSecurityOverview";
import SavedBeneficiaries from "./routes/dashboard/foundations/SavedBeneficiaries";
import NotificationPreferences from "./routes/dashboard/foundations/NotificationPreferences";
import SupportCentre from "./routes/dashboard/foundations/SupportCentre";
import MyTickets from "./routes/dashboard/foundations/MyTickets";
import EventCheckIn from "./routes/dashboard/foundations/EventCheckIn";
import OrganizerOverview from "./routes/dashboard/foundations/OrganizerOverview";
import DashboardLayout from "./routes/layout/DashboardLayout";
import Services from "./routes/dashboard/Services";
import Dashboard from "./components/dashboard/main-page/Dashboard";
import NotificationsPage from "./routes/dashboard/NotificationsPage";
import AffiliatePage from "./routes/dashboard/AffiliatePage";
import { AlertTriangle, Info } from "lucide-react";
import { FaCircleCheck } from "react-icons/fa6";
import TransferFunds from "./routes/dashboard/TransferFunds";
import ReferralPage from "./routes/dashboard/ReferralPage";
import ReceiptLayout from "./routes/layout/ReceiptLayout";
import WithdrawFunds from "./routes/dashboard/WithdrawFunds";
import AddFunds from "./routes/dashboard/AddFunds";
import FundingReturn from "./routes/dashboard/FundingReturn";
import StaticAccount from "./routes/dashboard/StaticAccount";
import Airtime from "./components/dashboard/services/airtime/Airtime";
import Data from "./components/dashboard/services/data/Data";
import Electricity from "./components/dashboard/services/electricity/Electricity";
import TVCable from "./components/dashboard/services/tv-cable/TVCable";
import Epin from "./components/dashboard/services/epin/Epin";
import ESim from "./components/dashboard/services/esim/ESim";
import FlightBookingPage from "./routes/dashboard/FlightBookingPage";
import AirlineDetails from "./components/dashboard/flights/AirlineDetails";
import MobileMoney from "./components/dashboard/services/mobile-money/MobileMoney";
import PassengerDetails from "./components/dashboard/flights/PassengerDetails";
import ConfirmFlightPayment from "./components/dashboard/flights/ConfirmFlightPayment";
import SettingsPage from "./routes/dashboard/SettingsPage";
import AccountSettings from "./components/dashboard/settings/AccountSettings";
import IdentityVerificationSettings from "./components/dashboard/settings/IdentityVerificationSettings";
import SecuritySettings from "./components/dashboard/settings/SecuritySettings";
import BankInfoSettings from "./components/dashboard/settings/BankInfoSettings";
import Support from "./components/dashboard/settings/Support";
import Faqs from "./components/dashboard/settings/Faqs";
import Hotels from "./routes/dashboard/Hotels";
import CustomerInfo from "./components/dashboard/hotels/CustomerInfo";
import ConfirmHotelPayment from "./components/dashboard/hotels/ConfirmHotelPayment";
import VirtualCard from "./routes/dashboard/VirtualCard";
import VirtualCardDetails from "./components/dashboard/virtual-card/VirtualCardDetails";
import FundVirtualCard from "./routes/dashboard/FundVirtualCard";
import VirtualCardWithdraw from "./routes/dashboard/VirtualCardWithdraw";
import History from "./routes/dashboard/History";
import TxnHistoryDetail from "./routes/dashboard/TxnHistoryDetail";
import Events from "./components/dashboard/events/Events";
import NotFoundPage from "./components/NotFoundPage";
import TwoFAOtp from "./routes/auth-pages/TwoFAOtp";
import { BiErrorCircle } from "react-icons/bi";
import InternationalAirtime from "./components/dashboard/services/international-airtime/InternationalAirtime";
import InternationalData from "./components/dashboard/services/international-data/InternationalData";

function DeferredFeatureGuard({children}: {children: React.ReactNode}) {
  const location = useLocation();
  return isDeferredOrExcludedRoute(location.pathname)
    ? <Navigate to="/dashboard/services" replace />
    : <>{children}</>;
}

const inactiveAuthScreens = new Set(["/auth/verify-phone", "/auth/user-details", "/auth/set-pin"]);
function InactiveAuthGuard({children}: {children: React.ReactNode}) {
  const {pathname} = useLocation();
  return inactiveAuthScreens.has(pathname) ? <Navigate to="/auth/login" replace/> : <>{children}</>;
}
function App() {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <MainLayout />,
      children: [
        {
          path: "/",
          element: <Homepage />,
        },
        {
          path: "/about",
          element: <About />,
        },
        {
          path: "/contact",
          element: <ContactPage />,
        },
        {
          path: "/faqs",
          element: <Faq />,
        },
        {
          path: "/privacy-policy",
          element: <PrivacyPolicy />,
        },
        {
          path: "/terms",
          element: <TermsPage />,
        },
      ]
    },
    ...(import.meta.env.VITE_TWIPAY_DEV_GUIDE === "true"
      ? [{ path: "/guide", element: <Guide /> }]
      : []),
    {
      path: "/auth",
      element: <InactiveAuthGuard><AuthLayout /></InactiveAuthGuard>,
      children: [
        {
          path: "login",
          element: <Login />,
        },
        {
          path: "google-complete",
          element: <GoogleComplete />,
        },
        {
          path: "two-factor-authentication",
          element: <MfaChallengeRoute><TwoFAOtp /></MfaChallengeRoute>,
        },
        {
          path: "signup",
          element: <SignUp />,
        },
        {
          path: "verify-phone",
          element: <VerifyPhone />,
        },
        {
          path: "user-details",
          element: <UserDetails />,
        },
        {
          path: "verify-email",
          element: <VerifyEmail />,
        },
        {
          path: "set-pin",
          element: <SetTransactionPin />,
        },
        {
          path: "reset-password",
          element: <ResetPassword />,
        },
      ]
    },
    {
      path: "/dashboard",
      element: <DeferredFeatureGuard><DashboardLayout /></DeferredFeatureGuard>,
      children: [
        {
          index: true,
          element: <Dashboard />
        },
        {
          path: "history",
          element: <History />
        },
        {
          path: "history/:id",
          element: <TxnHistoryDetail />
        },
        {
          path: "transfer-funds",
          element: <TransferFunds />
        },
        {
          path: "withdraw-funds",
          element: <WithdrawFunds />
        },
        {
          path: "add-funds",
          element: <AddFunds />
        },
        {
          path: "static-account",
          element: <StaticAccount />
        },
        {
          path: "services",
          element: <Services />
        },
        {
          path: "services/airtime",
          element: <Airtime />
        },
        {
          path: "services/data",
          element: <Data />
        },
        {
          path: "services/international-airtime",
          element: <InternationalAirtime />
        },
        {
          path: "services/international-data",
          element: <InternationalData />
        },
        {
          path: "services/electricity",
          element: <Electricity />
        },
        {
          path: "services/cable",
          element: <TVCable />
        },
        {
          path: "services/epin",
          element: <Epin />
        },
        {
          path: "services/esim",
          element: <ESim />
        },
        {
          path: "services/mobile-money",
          element: <MobileMoney />
        },
        {
          path: "events",
          element: <Events />
        },
        {
          path: "book-flight",
          element: <FlightBookingPage />
        },
        {
          path: "flight/passenger-info",
          element: <PassengerDetails />
        },
        {
          path: "airline/:id",
          element: <AirlineDetails />
        },
        {
          path: "flight/:id/confirm",
          element: <ConfirmFlightPayment />
        },
        {
          path: "hotels",
          element: <Hotels />
        },
        {
          path: "hotels/:id/customer-info",
          element: <CustomerInfo />
        },
        {
          path: "hotel/:id/confirm",
          element: <ConfirmHotelPayment />
        },
        {
          path: "affiliate",
          element: <AffiliatePage />
        },
        {
          path: "referral",
          element: <ReferralPage />
        },
        {
          path: "notifications",
          element: <NotificationsPage />
        },       
        {
          path: "status",
          // Retired mock status page declared success with a hardcoded balance/recipient.
          element: <Navigate to="/dashboard/history" replace />
        },
        {
          path: "settings",
          element: <SettingsPage />
        },
        {
          path: "settings/account",
          element: <AccountSettings />
        },
        {
          path: "settings/identity-verification",
          element: <IdentityVerificationSettings />
        },
        {
          path: "settings/security",
          element: <SecuritySettings />
        },
        {
          path: "settings/bank-info",
          element: <BankInfoSettings />
        },
        {
          path: "settings/support",
          element: <Support />
        },
        {
          path: "settings/faqs",
          element: <Faqs />
        },
        {
          path: "settings/security-overview",
          element: <AccountSecurityOverview />
        },
        {
          path: "settings/beneficiaries",
          element: <SavedBeneficiaries />
        },
        {
          path: "settings/notification-preferences",
          element: <NotificationPreferences />
        },
        {
          path: "settings/support-centre",
          element: <SupportCentre />
        },
        {
          path: "my-tickets",
          element: <MyTickets />
        },
        {
          path: "organizer",
          element: <OrganizerOverview />
        },
        {
          path: "event-check-in",
          element: <EventCheckIn />
        },
        {
          path: "virtual-card",
          element: <VirtualCard />
        },
        {
          path: "virtual-card/details",
          element: <VirtualCardDetails />
        },
        {
          path: "virtual-card/fund",
          element: <FundVirtualCard />
        },
        {
          path: "virtual-card/withdraw",
          element: <VirtualCardWithdraw />
        },
      ]
    },
    {
      path: "/wallet/fund/complete",
      element: <FundingReturn />
    },
    {
      path: "/receipt",
      element: <AuthenticatedCustomerRoute><ReceiptLayout /></AuthenticatedCustomerRoute>
    },
    {
      path: "*",
      element: <NotFoundPage />, //custom 404 page
    },
  ]);
  

  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: "rounded-md font-medium px-3 py-2 text-sm shadow-lg flex items-center gap-2",
            description: "mt-1 text-sm",
            // Per-type variant styling
            success: "bg-green-100 text-green-800",
            error:   "bg-red-100   text-red-800",
            warning: "bg-yellow-100 text-yellow-800",
            info:    "bg-blue-100  text-blue-800",
            icon:    "group-data-[type=success]:text-green-600 group-data-[type=error]:text-red-600 group-data-[type=warning]:text-yellow-600 group-data-[type=info]:text-blue-600",
          },
        }}
        icons={{
          success: <FaCircleCheck className="text-green-800 size-4" />,
          warning: <AlertTriangle className="text-yellow-500 size-4" />,
          info: <Info className="text-blue-500 size-4" />,
          error: <BiErrorCircle className="text-red-500 size-4" />
        }}
      />
      <RouterProvider router={router} />
    </>
  )
}

export default App
