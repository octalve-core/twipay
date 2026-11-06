import {FoundationPage,FoundationPanel,FoundationLink,FoundationUnavailable} from '@/components/design-system/ErhaFoundationUI';
import { brand } from "@/config/brand";
export default function AccountSecurityOverview(){
 return <FoundationPage title="Account security" description={`Manage the ways you keep your ${brand.name} account safe.`}>
  <FoundationPanel title="Protect your account" description="Choose how you sign in and review your identity details.">
   <FoundationLink to="/dashboard/settings/security" title="Security settings" description="Review available two-step verification settings."/>
   <FoundationLink to="/dashboard/settings/identity-verification" title="Identity verification" description="Check your verification progress."/>
  </FoundationPanel>
  <FoundationPanel title="More account controls">
   <FoundationUnavailable title="Transaction PIN" description="PIN setup and confirmation will be available after additional account protection is enabled. It will be required for supported payments."/>
   <FoundationUnavailable title="Signed-in devices" description="Review and end other sessions when account activity controls are available."/>
  </FoundationPanel>
 </FoundationPage>;
}
