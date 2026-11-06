# Walkthrough screenshots (2026-11-06 run)

Curated from the strict final run of `tests/walkthrough` at commit `046a02c` (steps are `sNNN` in its timeline). All accounts are fictional `.example` addresses on the isolated walkthrough stack. The customer ones are listed in the in-app `/guide` page.

| File | App | Step | What it shows |
| :-- | :-- | :-- | :-- |
| wt-01-landing.png | customer | s001 | **Landing page**: The public home page. |
| wt-02-signup-empty.png | customer | s008 | **Sign-up: empty form**: Submitting the sign-up form empty shows what each field needs. |
| wt-03-wrong-verification-code.png | customer | s011 | **Wrong verification code**: A wrong six-digit code is refused with a message; the right code from the development inbox is accepted. |
| wt-04-dashboard.png | customer | s013 | **Dashboard**: After verifying the email you land on the dashboard. The avatar shows initials because the account has no photo. |
| wt-05-history-empty.png | customer | s014 | **History**: A new account has no transactions. Export CSV stays disabled until there are some. |
| wt-06-services.png | customer | s019 | **Services**: Only airtime, data, electricity and TV/cable are offered. Deferred features are not shown. |
| wt-07-withdraw-paused.png | customer | s043 | **Withdraw while transfers are paused**: With bank transfers switched off the page says so and Proceed stays disabled. |
| wt-08-data-paused.png | customer | s045 | **Buy data while bill payments are paused**: Bill payments are switched off in this stack: the page explains it and Proceed is disabled. |
| wt-09-change-password-dialog.png | customer | s053 | **Security settings: change password**: The change-password dialog opens from Security settings and closes with Escape. |
| wt-10-account-state-saved.png | customer | s057 | **Account details are saved**: A changed state is still there after leaving the page and coming back. |
| wt-11-signed-out-guard.png | customer | s062 | **Signed-out guard**: After logging out, pressing Back does not show the dashboard. |
| wt-12-two-factor-signed-in.png | customer | s067 | **Two-factor sign-in**: with two-factor authentication on, signing in asks for the six-digit code from the authenticator app; after the code the dashboard opens. |
| wt-13-support-reply.png | customer | s145 | **Support reply in the help centre**: The customer reads the support agent's reply to their request. |
| wt-14-suspended-refused.png | customer | s152 | **Suspended account**: A suspended customer cannot sign in. |
| wt-20-admin-wrong-password.png | admin | s089 | **Staff sign-in: wrong password**: The console refuses a wrong password with one message. |
| wt-21-owner-needs-mfa.png | admin | s091 | **Owner Control before MFA**: Before an authenticator is enrolled the page explains that a step-up is needed. |
| wt-22-admin-overview.png | admin | s098 | **Overview**: The operations overview after sign-in and step-up. |
| wt-23-staff-governance.png | admin | s110 | **Staff governance**: Owners propose roles here; another owner must approve. |
| wt-24-own-approval-refused.png | admin | s121 | **Owner approving their own proposal**: The console refuses and says a different owner must approve. |
| wt-25-independent-approval.png | admin | s124 | **Independent approval**: The second owner approves the proposal. |
| wt-26-support-agent-menu.png | admin | s129 | **Support agent menu**: a support agent sees only Support Cases and Security & MFA, and the case list asks for a step-up first. |
| wt-27-finance-operator-menu.png | admin | s131 | **Finance operator menu**: A finance operator sees only the pages the role allows. |
| wt-28-support-case-reply.png | admin | s142 | **Support case reply**: The support agent reviews a ticket and replies. |
| wt-29-suspension-prepared.png | admin | s148 | **Suspension prepared**: An owner prepares a customer suspension; it needs a second owner. |
| wt-30-suspension-approved.png | admin | s150 | **Suspension approved**: The second owner approves the suspension as checker. |
