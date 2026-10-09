import {FoundationPage,FoundationPanel,FoundationLink,FoundationUnavailable} from '@/components/design-system/ErhaFoundationUI';
export default function SavedBeneficiaries(){
 return <FoundationPage title="Saved beneficiaries" description="Keep the people and bank accounts you pay in one place.">
  <FoundationPanel title="Your beneficiaries" description="You'll be able to view and manage saved recipients here once the service is available.">
   <FoundationUnavailable title="Save a bank account" description="Saving, changing or removing beneficiaries is not available yet. No accounts have been saved through this page."/>
   <FoundationLink to="/dashboard/history" title="Transaction history" description="Review transfers and other payments already recorded on your account."/>
  </FoundationPanel>
 </FoundationPage>;
}
