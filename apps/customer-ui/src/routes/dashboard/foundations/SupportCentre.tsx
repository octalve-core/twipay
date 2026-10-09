import {FoundationPage,FoundationPanel,FoundationLink,FoundationUnavailable} from '@/components/design-system/ErhaFoundationUI';
export default function SupportCentre(){
 return <FoundationPage title="Help and support" description="Find answers or get help with a payment.">
  <FoundationPanel title="How can we help?">
   <FoundationLink to="/dashboard/settings/support" title="Report a transaction issue" description="Raise a dispute about a transaction on your account."/>
   <FoundationLink to="/dashboard/settings/faqs" title="Frequently asked questions" description="Find answers to common questions."/>
   <FoundationUnavailable title="General support requests" description="A dedicated help inbox for general enquiries will be available here soon."/>
  </FoundationPanel>
 </FoundationPage>;
}
