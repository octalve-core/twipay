# Repository Boundaries

`apps/*` may compose use cases. `packages/contracts` and future domain packages must not import provider SDKs. Provider-specific dependencies belong under `packages/providers/<capability>/<provider>`. Database details do not leak into UI components. The admin app does not become a hidden customer route; it is a separate deployment/security surface.
