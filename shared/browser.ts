/**
 * Browser-safe shared entrypoint.
 *
 * Keep validation out of browser bundles so CRA/Webpack does not evaluate Zod
 * schemas when the frontend only needs pure utilities.
 */
export * from "./utils";
