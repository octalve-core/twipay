/**
 * Batch 2.5: existing ErhaPay visual language for newly introduced pages only.
 * No invented profile, financial, messaging or organizer state belongs here.
 */
import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {HiOutlineChevronRight} from 'react-icons/hi2';
import {ErhaPageFrame,ErhaPageHeading,ErhaSettingsPanel} from './ErhaPagePrimitives';

export function FoundationPage({title,description,children}:{title:string;description:string;children:ReactNode}){
 return <ErhaPageFrame className="pb-16"><ErhaPageHeading title={title} description={description} backHref="/dashboard/settings"/><div className="mt-6 md:mt-8">{children}</div></ErhaPageFrame>;
}
export function FoundationPanel({title,description,children}:{title:string;description?:string;children:ReactNode}){
 return <ErhaSettingsPanel className="bg-white p-5 md:p-6 mb-4"><h2 className="text-[#112929] text-lg font-bold">{title}</h2>{description&&<p className="text-[#667085] text-sm mt-2">{description}</p>}{children}</ErhaSettingsPanel>;
}
export function FoundationLink({to,title,description}:{to:string;title:string;description:string}){
 return <Link to={to} className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-[#F0F2F5] bg-white px-4 py-3 text-[#344054] transition hover:border-[#112929] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#112929]"><span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-[#667085] mt-1">{description}</span></span><HiOutlineChevronRight aria-hidden="true" className="shrink-0 text-[#112929]"/></Link>;
}
export function FoundationUnavailable({title,description}:{title:string;description:string}){
 return <section aria-label={title} className="rounded-lg border border-[#F0F2F5] bg-[#F9FAFB] p-4 mt-4"><p className="text-[#344054] font-medium text-sm">{title}</p><p className="mt-1 text-[#667085] text-sm">{description}</p><span className="mt-2 inline-block text-xs font-medium text-[#475467]">Coming soon</span></section>;
}
