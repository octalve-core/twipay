import BackButton from "@/components/Authentication/BackButton";
import CreateStaticAccount from "@/components/dashboard/static-account/CreateStaticAccount"
import StaticAccountDetails from "@/components/dashboard/static-account/StaticAccountDetails";
import { useAuth } from "@/context/AuthContext";

const StaticAccount = () => {
  const {user} = useAuth();

  return (
    <div className="w-full min-h-full grid place-items-center">
      <section className="w-full max-w-[410px] max-md:self-start">
        <BackButton className="mb-8 mr-auto max-md:hidden" href="/dashboard" /> 
        {(user?.bvnValidated && user.bvnVerified) && <StaticAccountDetails />}
        {(!user?.bvnVerified && !user?.bvnValidated) && <CreateStaticAccount />}
        {/* {(!user?.bvn_validated && user?.bvn_verified) && <VerifyValidationOtp />} */}
      </section>
    </div>
  )
}

export default StaticAccount