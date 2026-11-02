// The declarations the package ships (grooph.d.ts) are what the code is: this fails to compile when they part, in
// what is exported, in a type, or in a function's parameters or result.
import type * as Declared from "./grooph.js";
import type * as Code from "./index.js";
import * as code from "./index.js";

/** True only when the two are the same type. */
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const same = <T extends true>(): T[] => [];

export const declared: typeof Declared = code;
export const checked = [
  same<Same<keyof typeof Declared, keyof typeof code>>(),
  same<Same<Declared.Layout, Code.Layout>>(),
  same<Same<Declared.View, Code.View>>(),
  same<Same<Declared.RenderOptions, Code.RenderOptions>>(),
  same<Same<Declared.Rendered, Code.Rendered>>(),
  same<Same<Declared.ErrorCode, Code.ErrorCode>>(),
  same<Same<Declared.Mounted, Code.Mounted>>(),
  same<Same<Parameters<typeof Declared.render>, Parameters<typeof code.render>>>(),
  same<Same<ReturnType<typeof Declared.render>, ReturnType<typeof code.render>>>(),
  same<Same<Parameters<typeof Declared.mount>, Parameters<typeof code.mount>>>(),
  same<Same<ReturnType<typeof Declared.mount>, ReturnType<typeof code.mount>>>(),
  same<Same<Parameters<typeof Declared.drawAll>, Parameters<typeof code.drawAll>>>(),
  same<Same<ReturnType<typeof Declared.drawAll>, ReturnType<typeof code.drawAll>>>(),
  same<Same<ConstructorParameters<typeof Declared.GroophError>, ConstructorParameters<typeof code.GroophError>>>(),
  same<Same<Declared.GroophError["code"], Code.GroophError["code"]>>(),
];
