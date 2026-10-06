/**
 * A plan's files (slice 0100, amendment A-020): `PLAN.md`, the picture and the document itself, for any graph that
 * reads, whether or not a harness could run it. Core makes them (`planBundleWith`); this file hands core's maker
 * the parts of core every address has, and names the zip.
 *
 * It is part of the Export panel's piece (`ui/ExportDoor.tsx`), so no address loads the maker first. The maker
 * imports nothing and is handed its parts (`packages/core/src/plan-kit.ts` says why), so carrying it moves nothing else.
 *
 * The picture handed in is the one the app draws everywhere else, and the one "Keep a copy" gives. For a graph
 * with no subgrooph it is, byte for byte, what `grooph`'s own plan holds; a subgrooph is drawn here as its nodes
 * and there as one box.
 */
import { canonicalize, outline, outlineMarkdown, picture, validate, type Graph } from "@grooph/core";
import { planBundleWith, type PlanBundle } from "@grooph/core/plan";

/** The plan of a document that reads as a graph. */
export const planOf = (doc: Graph): PlanBundle => planBundleWith([canonicalize, outline, outlineMarkdown, validate, (graph) => picture(graph)], doc);

export const planZipName = (doc: Graph): string => `${doc.id || "graph"}-plan.zip`;

/** How a file of the plan is handed to the browser. */
export const planFileType = (path: string): string => (path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".json") ? "application/json" : "text/markdown");
