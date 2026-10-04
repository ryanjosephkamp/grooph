/**
 * Core, whole: `base.ts` and the compiler. See `base.ts` for why they are two files.
 */
export * from "./base.js";
export { compile, tryCompile, CompileError } from "./compile/index.js";
