import {FoundationPage,FoundationPanel,FoundationLink,FoundationUnavailable} from '@/components/design-system/ErhaFoundationUI';
export default function NotificationPreferences(){
 return <FoundationPage title="Notification preferences" description="Choose how you would like to hear from TwiPay.">
  <FoundationPanel title="Your messages" description="Recent messages are available in your notification history.">
   <FoundationLink to="/dashboard/notifications" title="Notification history" description="View updates sent to your account."/>
   <FoundationUnavailable title="Notification preferences" description="Email, text-message and in-app preferences will be available here when they can be saved securely."/>
  </FoundationPanel>
 </FoundationPage>;
}
