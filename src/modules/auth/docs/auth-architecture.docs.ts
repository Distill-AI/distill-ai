/**
 * NFR-SEC-5: Config-Gated Auth (RBAC + RLS)
 *
 * ## Architecture
 *
 * AuthModule is a @Global() module registered in AppModule.
 * AuthGuard is registered as APP_GUARD, applying to every route.
 * RlsContextMiddleware runs on every request to set PostgreSQL session context.
 *
 * ## Config Gating
 *
 * AUTH_ENABLED=false (demo): All requests pass through. @Roles() decorator is inert.
 * AuthService returns dummy user (admin + estimator roles) for demo-org.
 *
 * AUTH_ENABLED=true (production): JWT validation enforced on every request.
 * - Missing/invalid token → 401 Unauthorized
 * - Valid token but insufficient role → 403 Forbidden
 * - RLS middleware sets app.org_id before query execution
 *
 * ## Guard flow
 * 1. If AUTH_ENABLED=false → return true immediately
 * 2. Read @Roles() metadata from handler
 * 3. If no @Roles() decorator → return true (public endpoint)
 * 4. Extract Bearer token from Authorization header
 * 5. Validate JWT (signature, expiry, required claims)
 * 6. Build AuthUser from decoded token, attach to request.user
 * 7. Check if user has at least one required role
 * 8. Role match → return true | mismatch → 403
 *
 * ## RLS Middleware flow
 * 1. Extract token from request
 * 2. Validate token → get orgId
 * 3. Execute SET app.org_id = '<orgId>' on the PostgreSQL connection
 * 4. All subsequent queries in this request use RLS policies scoped to orgId
 *
 * ## Roles
 * - admin: Full access
 * - estimator: Create/update quotes, requests
 * - viewer: Read-only access
 * - system: Internal service accounts
 */
export const AUTH_ARCHITECTURE = 'NFR-SEC-5 Config-Gated Auth (RBAC + RLS)';
