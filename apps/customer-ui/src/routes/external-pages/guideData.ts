// Generated from docs/screenshots (2026-10-13). Keep captions in step with docs/guide/README.md.
export const authSteps = [
  {
    file: "01-signup-validation-errors.png",
    title: "Sign-up form errors",
    text: "Submitting the sign-up form with bad input shows a message under each field. A password needs at least 12 characters.",
  },
  {
    file: "02-verify-email-page.png",
    title: "Verify your email",
    text: "After registering you are asked for the six-digit code sent to your email. In the development build the email appears in the floating inbox button.",
  },
  {
    file: "03-wrong-code-error-field-cleared.png",
    title: "Wrong verification code",
    text: "A wrong code shows an error and clears the field so you can type the right one straight away.",
  },
  {
    file: "04-dashboard-after-verification.png",
    title: "Dashboard",
    text: "Once your email is verified you land on the dashboard.",
  },
  {
    file: "05-login-wrong-password-message.png",
    title: "Login: wrong password",
    text: "A wrong password or unknown email gives the same message, so nobody can tell which emails are registered by logging in.",
  },
  {
    file: "06-signup-duplicate-email-message.png",
    title: "Sign-up: email already registered",
    text: "Registering an email that already exists tells you so (known issue ISS-002: this reveals registered emails).",
  },
  {
    file: "09-login-rate-limited-message.png",
    title: "Too many attempts",
    text: "After 10 login or sign-up attempts in a minute you are asked to wait, with the number of seconds.",
  },
  {
    file: "07b-reset-code-entered.png",
    title: "Reset password: code",
    text: "Enter your email, then the eight-digit code sent to you.",
  },
  {
    file: "07c-set-new-password-step.png",
    title: "Reset password: new password",
    text: "Choose a new password (at least 12 characters).",
  },
  {
    file: "08-password-updated.png",
    title: "Password updated",
    text: "Confirmation after the reset. The old password no longer works.",
  },
  {
    file: "10-admin-wrong-password.png",
    title: "Admin: wrong password",
    text: "The admin console has its own sign-in; wrong details show an error.",
  },
  {
    file: "11-admin-after-login.png",
    title: "Admin: after sign-in",
    text: "What a signed-in staff user sees. The owner area additionally needs a verified email, the SUPER_ADMIN role and MFA.",
  },
  {
    file: "12-dev-inbox-panel.png",
    title: "Development inbox",
    text: "The floating envelope button lists every email the app sends in development, with copy buttons for codes.",
  },
] as const;

export const walkthroughSteps = [
  {
    file: "wt-01-landing.png",
    title: "Landing page",
    text: "The public home page.",
  },
  {
    file: "wt-02-signup-empty.png",
    title: "Sign-up: empty form",
    text: "Submitting the sign-up form empty shows what each field needs.",
  },
  {
    file: "wt-03-wrong-verification-code.png",
    title: "Wrong verification code",
    text: "A wrong six-digit code is refused with a message; the right code from the development inbox is accepted.",
  },
  {
    file: "wt-04-dashboard.png",
    title: "Dashboard",
    text: "After verifying the email you land on the dashboard. The avatar shows initials because the account has no photo.",
  },
  {
    file: "wt-05-history-empty.png",
    title: "History",
    text: "A new account has no transactions. Export CSV stays disabled until there are some.",
  },
  {
    file: "wt-06-services.png",
    title: "Services",
    text: "Only airtime, data, electricity and TV/cable are offered. Deferred features are not shown.",
  },
  {
    file: "wt-07-withdraw-paused.png",
    title: "Withdraw while transfers are paused",
    text: "With bank transfers switched off the page says so and Proceed stays disabled.",
  },
  {
    file: "wt-08-data-paused.png",
    title: "Buy data while bill payments are paused",
    text: "Bill payments are switched off in this stack: the page explains it and Proceed is disabled.",
  },
  {
    file: "wt-09-change-password-dialog.png",
    title: "Security settings: change password",
    text: "The change-password dialog opens from Security settings and closes with Escape.",
  },
  {
    file: "wt-10-account-state-saved.png",
    title: "Account details are saved",
    text: "A changed state is still there after leaving the page and coming back.",
  },
  {
    file: "wt-11-signed-out-guard.png",
    title: "Signed-out guard",
    text: "After logging out, pressing Back does not show the dashboard.",
  },
  {
    file: "wt-12-two-factor-signed-in.png",
    title: "Two-factor sign-in",
    text: "With two-factor authentication on, signing in asks for the six-digit code from the authenticator app; after the code the dashboard opens.",
  },
  {
    file: "wt-13-support-reply.png",
    title: "Support reply in the help centre",
    text: "The customer reads the support agent's reply to their request.",
  },
  {
    file: "wt-14-suspended-refused.png",
    title: "Suspended account",
    text: "A suspended customer cannot sign in.",
  },
] as const;

export const routeShots = [
  {
    route: "/",
    file: "route-ui-home.png",
    group: "Public pages",
    note: "",
  },
  {
    route: "/about",
    file: "route-ui-about.png",
    group: "Public pages",
    note: "",
  },
  {
    route: "/privacy-policy",
    file: "route-ui-privacy-policy.png",
    group: "Public pages",
    note: "",
  },
  {
    route: "/terms",
    file: "route-ui-terms.png",
    group: "Public pages",
    note: "",
  },
  {
    route: "/auth/login",
    file: "route-ui-auth-login.png",
    group: "Public pages",
    note: "",
  },
  {
    route: "/auth/signup",
    file: "route-ui-auth-signup.png",
    group: "Public pages",
    note: "",
  },
  {
    route: "/auth/reset-password",
    file: "route-ui-auth-reset-password.png",
    group: "Public pages",
    note: "",
  },
  {
    route: "/dashboard",
    file: "route-ui-dashboard.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/history",
    file: "route-ui-dashboard-history.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/withdraw-funds",
    file: "route-ui-dashboard-withdraw-funds.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/add-funds",
    file: "route-ui-dashboard-add-funds.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/static-account",
    file: "route-ui-dashboard-static-account.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/services",
    file: "route-ui-dashboard-services.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/services/airtime",
    file: "route-ui-dashboard-services-airtime.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/services/data",
    file: "route-ui-dashboard-services-data.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/services/electricity",
    file: "route-ui-dashboard-services-electricity.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/services/cable",
    file: "route-ui-dashboard-services-cable.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/events",
    file: "route-ui-dashboard-events.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/notifications",
    file: "route-ui-dashboard-notifications.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/settings",
    file: "route-ui-dashboard-settings.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/settings/account",
    file: "route-ui-dashboard-settings-account.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/settings/identity-verification",
    file: "route-ui-dashboard-settings-identity-verification.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/settings/security",
    file: "route-ui-dashboard-settings-security.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/settings/bank-info",
    file: "route-ui-dashboard-settings-bank-info.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/settings/support",
    file: "route-ui-dashboard-settings-support.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/settings/security-overview",
    file: "route-ui-dashboard-settings-security-overview.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/settings/beneficiaries",
    file: "route-ui-dashboard-settings-beneficiaries.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/settings/notification-preferences",
    file: "route-ui-dashboard-settings-notification-preferences.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/settings/support-centre",
    file: "route-ui-dashboard-settings-support-centre.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/my-tickets",
    file: "route-ui-dashboard-my-tickets.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/organizer",
    file: "route-ui-dashboard-organizer.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/dashboard/event-check-in",
    file: "route-ui-dashboard-event-check-in.png",
    group: "Dashboard",
    note: "",
  },
  {
    route: "/receipt",
    file: "route-ui-receipt.png",
    group: "Dashboard",
    note: "",
  },
] as const;
