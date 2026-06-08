/**
 * Squad Map — type-resolution shim only. Metro always prefers the
 * platform-specific implementations (SquadMap.native.tsx for iOS/Android,
 * SquadMap.web.tsx for the web bundle) over this file at bundle time, so this
 * module never actually loads at runtime; it exists purely so `tsc` and any
 * non-platform-aware tooling can resolve `./SquadMap` to a concrete type.
 */
export { SquadMap, type SquadMapProps } from './SquadMap.web';
