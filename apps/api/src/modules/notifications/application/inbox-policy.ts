/** Fixed, safe, non-sensitive summaries only. Do not copy provider bodies or subjects here. */
export const INBOX_TEMPLATES = {
  SUPPORT_REPLY: {category:'SUPPORT', title:'Support has replied', message:'There is a new reply to your support request.', targetPath:'/dashboard/settings/support-centre', preference:'supportInApp'},
  EVENT_TICKETS_ISSUED: {category:'EVENTS', title:'Your tickets are available', message:'Your event tickets are ready to view in TwiPay.', targetPath:'/dashboard/my-tickets', preference:'eventInApp'},
  PASSWORD_RESET_SECURITY_ALERT: {category:'SECURITY', title:'Password reset', message:'Your account password was reset. Review your account security if this was unexpected.', targetPath:'/dashboard/settings/security-overview'},
  PASSWORD_CHANGED_SECURITY_ALERT: {category:'SECURITY', title:'Password changed', message:'Your account password has changed. Review account security if this was unexpected.', targetPath:'/dashboard/settings/security-overview'},
  PASSWORD_ENROLLMENT_ALERT: {category:'SECURITY', title:'Password added', message:'A password was added to your account.', targetPath:'/dashboard/settings/security-overview'},
  TRANSACTION_PIN_SECURITY_ALERT: {category:'SECURITY', title:'Transaction PIN updated', message:'Your transaction PIN settings changed. Review account security if this was unexpected.', targetPath:'/dashboard/settings/security-overview'},
} as const;
export type InboxTemplateCode = keyof typeof INBOX_TEMPLATES;
export function safeInboxTemplate(code:string) {
  return Object.prototype.hasOwnProperty.call(INBOX_TEMPLATES,code) ? INBOX_TEMPLATES[code as InboxTemplateCode] : null;
}
