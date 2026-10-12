# Batch A — original ErhaPay source preservation and TwiPay auth integration

The **actual original ErhaPay React/Vite frontend** is copied into `apps/customer-ui`. Its original logo image remains unchanged. No wholesale Next.js UI reconstruction was attempted. Original TwiPay API, Next.js web/admin, worker and financial services are not replaced.

## Source baseline
- ErhaPay archive SHA-256: `aec7912e7d67e1d0db481f79544a048263dffae456198fa7adc6f2b19b0c84c6`
- Original file entries (excluding ZIP directory placeholders): **460**
- Original files under `src/`: **443**
- Original image/asset entries: **141**
- Original files unchanged byte-for-byte: **363 / 460**
- Original files with intentional changes: **97**

See `BATCH_A_PRESERVATION_INVENTORY.json` for **every original file name, SHA-256 and preservation status**. Original asset image binaries have not been redesigned.

## Controlled changes
- Public brand text/title/accessibility alt text updated to TwiPay; **old logo bytes preserved** temporarily.
- Customer UI retains its original Vite routes, Tailwind classes, layouts and reusable visual components.
- Login/register use TwiPay API session-cookie contracts; no bearer/refresh tokens are written to browser storage.
- The account is re-validated with `/v1/auth/me` on application load. MFA enrollment state determines whether the existing six-box authenticator screen is required.
- TOTP challenge calls `/v1/auth/mfa/challenge` with session-bound CSRF; legacy emailed OTP/resend assumptions removed.
- Existing unreviewed financial and settings endpoints are **fail-closed**, not silently rewritten to mismatched TwiPay routes.
- Future modules remain in source but cannot be accessed from normal navigation or direct route URLs; betting is permanently excluded.
- Fake credit-card numbers/balance removed, and unverified testimonials/referral/card marketing paused.
- Inherited browser console diagnostics removed without changing layout CSS.

## Status of product modules

| Module | Batch A status |
|---|---|
| Register / login / session restore / logout | Wired at source level; runtime API + browser tests pending |
| Enrolled TOTP step-up | Wired at source level; runtime tests pending |
| Wallet, virtual accounts, transfers | Existing screens retained, API calls fail-closed until Batch C mapping |
| Airtime, data, electricity, cable | Existing screens retained, API calls fail-closed until Batch D mapping |
| Events and tickets | Existing screens retained, require real API integration |
| e-PIN, international airtime/data, eSIM, mobile money, cards, flights/hotels, referral/affiliate | Source retained; inactive by direct route guard and filtered navigation |
| Betting | Permanently excluded; not linked or mounted |

## Major limitations
- A root-workspace `pnpm install` / Vite build was **not executed** because the npm registry was unreachable (`EAI_AGAIN`). Do not call this production-ready.
- This is an **isolated customer UI candidate** (`apps/customer-ui`), not an overwrite of production `apps/web`. A design-preserving migration/activation decision and visual regression tests are required.
- Original legal/privacy/terms text remains in source, not certified TwiPay legal copy. Pages must receive review before public deployment.
- Original Vite app uses UI compatibility fields where the TwiPay auth endpoint has no equivalent. These placeholders are **not authorization facts** and must not be used to make financial decisions.
- Existing backend code is the supplied RC2. Reported later developer ADR 016–018 code is **not included**; integrate only after inspecting the latest checkout.
- The existing root ZIP had three inherited modified backup/restore scripts before Batch A. These have been preserved, not silently reset.
- Backend high-risk flags remain disabled; no financial/backend source was modified in this batch.

## Deployment boundary
- Development: `VITE_TWIPAY_API_URL=http://localhost:4000`; exact API `APP_URL` must be `http://localhost:5173` for Vite development.
- Production: HTTPS same-site frontend/API origins; strict CORS; HttpOnly Secure SameSite session cookie; no browser storage of credentials.
- Finish customer endpoint migration, Playwright visual regression, CSRF/MFA/browser integration, and provider financial sandbox qualification before replacing `apps/web`.

## Intentionally modified original files

```
index.html
package.json
src/App.tsx
src/components/Authentication/AuthButtons.tsx
src/components/Authentication/CreateNewPasswordForm.tsx
src/components/Authentication/GoogleLoginButton.tsx
src/components/Authentication/LogInForm.tsx
src/components/Authentication/SignUpForm.tsx
src/components/Authentication/VerifyEmailForm.tsx
src/components/dashboard/add-funds/EnterAmount.tsx
src/components/dashboard/add-funds/SelectPaymentMethod.tsx
src/components/dashboard/events/ConfirmEventsBooking.tsx
src/components/dashboard/flights/BookFlightForm.tsx
src/components/dashboard/flights/ConfirmFlightPayment.tsx
src/components/dashboard/flights/PassengerDetails.tsx
src/components/dashboard/flights/PassengerInfoForm.tsx
src/components/dashboard/history/data-table.tsx
src/components/dashboard/history/history-mobile/TxnDetailMobile.tsx
src/components/dashboard/hotels/ConfirmHotelPayment.tsx
src/components/dashboard/hotels/CustomerInfoForm.tsx
src/components/dashboard/main-page/BalanceCard.tsx
src/components/dashboard/main-page/Campaign.tsx
src/components/dashboard/main-page/CreditCard.tsx
src/components/dashboard/main-page/History.tsx
src/components/dashboard/main-page/MobileOtherServicesDrawer.tsx
src/components/dashboard/main-page/OtherServices.tsx
src/components/dashboard/main-page/ServicesList.tsx
src/components/dashboard/services/ServicesSection.tsx
src/components/dashboard/services/airtime/ConfirmAirtimePayment.tsx
src/components/dashboard/services/airtime/RecipientDetails.tsx
src/components/dashboard/services/betting/ConfirmBettingPayment.tsx
src/components/dashboard/services/betting/RecipientDetails.tsx
src/components/dashboard/services/data/ConfirmDataPayment.tsx
src/components/dashboard/services/data/RecipientDetails.tsx
src/components/dashboard/services/electricity/ConfirmElectricityPayment.tsx
src/components/dashboard/services/electricity/RecipientDetails.tsx
src/components/dashboard/services/epin/ConfirmEPinPayment.tsx
src/components/dashboard/services/epin/Epin.tsx
src/components/dashboard/services/epin/RecipientDetails.tsx
src/components/dashboard/services/epin/SelectProvider.tsx
src/components/dashboard/services/esim/ConfirmESimPayment.tsx
src/components/dashboard/services/international-airtime/ConfirmAirtimePayment.tsx
src/components/dashboard/services/international-data/ConfirmDataPayment.tsx
src/components/dashboard/services/mobile-money/ConfirmMobileMoneyPayment.tsx
src/components/dashboard/services/tv-cable/ConfirmTvCablePayment.tsx
src/components/dashboard/services/tv-cable/RecipientDetails.tsx
src/components/dashboard/settings/AccountSettingForm.tsx
src/components/dashboard/settings/AccountSettings.tsx
src/components/dashboard/settings/AddNewBank.tsx
src/components/dashboard/settings/DeactivateAccount.tsx
src/components/dashboard/settings/LogOutAccount.tsx
src/components/dashboard/settings/Set2FAForm.tsx
src/components/dashboard/settings/SetTxnPinForm.tsx
src/components/dashboard/settings/Support.tsx
src/components/dashboard/settings/set2FAModal.tsx
src/components/dashboard/sidebar/DashboardLinks.tsx
src/components/dashboard/sidebar/SidebarFooter.tsx
src/components/dashboard/static-account/CreateStaticAccount.tsx
src/components/dashboard/static-account/StaticAccountDetails.tsx
src/components/dashboard/static-account/VerifyValidationOtp.tsx
src/components/dashboard/transfer-funds/ConfirmFundsTransfer.tsx
src/components/dashboard/transfer-funds/TransferFundsForm.tsx
src/components/dashboard/virtual-card/EnterFundingPin.tsx
src/components/dashboard/virtual-card/EnterWithdrawalPin.tsx
src/components/dashboard/withdraw-funds/ConfirmFundsWithdrawal.tsx
src/components/dashboard/withdraw-funds/EnterAmount.tsx
src/components/dashboard/withdraw-funds/RecipientDetailForm.tsx
src/components/external-pages/aboutpage/AboutPage.tsx
src/components/external-pages/aboutpage/OurMission.tsx
src/components/external-pages/contact-us-page/ContactUsForm.tsx
src/components/external-pages/faq/Faqs.tsx
src/components/external-pages/homepage/Features.tsx
src/components/external-pages/homepage/MobileAppLinks.tsx
src/components/external-pages/homepage/WhyUse.tsx
src/components/footer/Footer.tsx
src/components/navbar/Logo.tsx
src/components/receipt/DesktopReceipt.tsx
src/components/receipt/Receipt.tsx
src/context/AuthContext.tsx
src/lib/api/authApi.ts
src/lib/api/axios.ts
src/lib/api/dashboard-apis/settingsApis.ts
src/lib/constants.ts
src/lib/utils.ts
src/lib/zodSchemas/auth.schema.ts
src/main.tsx
src/routes/auth-pages/LogIn.tsx
src/routes/auth-pages/SetTransactionPin.tsx
src/routes/auth-pages/SignUp.tsx
src/routes/auth-pages/TwoFAOtp.tsx
src/routes/auth-pages/VerifyEmail.tsx
src/routes/auth-pages/VerifyPhone.tsx
src/routes/dashboard/AffiliatePage.tsx
src/routes/dashboard/History.tsx
src/routes/dashboard/Status.tsx
src/routes/external-pages/Homepage.tsx
src/routes/layout/DashboardLayout.tsx
```
