/**
 * Things to keep: the picture of a graph or an operation map as SVG or PNG,
 * and the offline page that holds the whole document and a viewer. Core draws
 * all three; this file only turns an SVG into pixels and names the files.
 */
import { isMapLike, mapPicture, offlinePage, picture, type Graph, type OperationMap } from "@grooph/core";

export type KeepTheme = "light" | "dark";

/** What `VERSION` in the CLI says: the grooph that made the file. */
export const APP_VERSION = "0.3.0";

const isMap = (doc: Graph | OperationMap): doc is OperationMap => isMapLike(doc);

/** `auto` is the picture that follows the viewer: what a theme is added to (`ui/theme/themes.ts`). */
export const pictureSvg = (doc: Graph | OperationMap, theme: KeepTheme | "auto"): string => (isMap(doc) ? mapPicture(doc, { theme }) : picture(doc, { theme }));

/** `look` is the theme's name when the picture is not in Paper: `review-loop.chalk-dark.svg`. */
export const pictureName = (doc: Graph | OperationMap, theme: KeepTheme, ext: "svg" | "png", look = ""): string => `${doc.id || "graph"}.${look && `${look}-`}${theme}.${ext}`;

export const pageHtml = (doc: Graph | OperationMap): string => offlinePage(doc, { version: APP_VERSION });

export const pageName = (doc: Graph | OperationMap): string => `${doc.id || "graph"}.html`;

/**
 * An SVG as a PNG, three device pixels to the unit, so a 400-unit picture is
 * 1,200 px wide: sharp on a phone and when zoomed. Drawn by the browser with
 * the device's own fonts; nothing leaves the device.
 */
export async function svgToPng(svg: string, scale = 3): Promise<Blob> {
  const size = /<svg[^>]* width="([\d.]+)" height="([\d.]+)"/.exec(svg);
  if (!size) throw new Error("the picture has no size");
  const width = Math.round(Number(size[1]) * scale);
  const height = Math.round(Number(size[2]) * scale);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("the browser could not draw the picture"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("this browser has no canvas to draw on");
    ctx.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("the browser could not make a PNG"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
