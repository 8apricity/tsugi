# Dialog navigation uses a typed route stack

Tsugi models dialog navigation with one application-specific, typed route
stack and at most one confirmation overlay. Back, Escape, and browser Back
remove one route; a header close button removes the whole flow. Dirty editors
hold the requested transition behind the confirmation overlay, while route
entries retain only stable identifiers, route-instance identifiers, semantic
focus-return targets, and navigation context. The React adapter keeps transient
viewport snapshots separately, keyed by the route-instance identifier.

The flow core is framework-independent TypeScript. React owns rendering and DOM
effects, and feature modules continue to own forms, remote data, and dirty
checks. Parent dialogs stay mounted but non-interactive while a child is active.
Async responses are accepted only while their route instance still exists, and
the adapter invalidates a route and its descendants when its required payload
disappears.
This keeps valid parent-child transitions, cleanup, browser navigation, and
return destinations in one testable module without turning the module into a
generic modal or data-fetching framework.

We rejected independent nullable visibility states because they allow
impossible combinations and duplicate Back and cleanup priorities. We also
rejected an unrestricted generic stack and one browser-history entry per dialog
because they leak transition rules to callers and would require stale dialog
state to be reconstructed by browser Forward.
