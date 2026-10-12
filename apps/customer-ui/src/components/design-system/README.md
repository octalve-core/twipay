# ErhaPay-derived UI composition (Phase 2.1)

This is NOT a new design system. It is an optional, additive composition layer
for customer pages that did not exist in the original ErhaPay project.

- `ErhaPageFrame`: original SettingsPage `max-w-[588px] mx-auto` alignment.
- `ErhaPageHeading`: original SettingsPage typography and BackButton.
- `ErhaSettingsPanel`: original Settings/AccountSettings white desktop panel and border.
- Use existing `CustomButton`, `BackButton`, `EmptyState`, `components/ui/*`,
  `DashboardLayout`, `DashboardHeader` and `Sidebar`; avoid replicas.
- Reuse original Aeonik and #112929 palette. Do not introduce new marketing
  colour tokens or replace the existing original logo at this checkpoint.
- Data, permissions, wallet balances, PIN and MFA belong to audited API/domain
  code, never these visual wrappers.
- There are deliberately no routes to these components yet: Phase 2.1 makes
  no untested visual changes to customer journeys.

See `docs/design/ERHAPAY_DESIGN_INVENTORY.md` and the generated component registry.
