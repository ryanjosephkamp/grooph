/**
 * Things to keep: the picture of a graph or an operation map as SVG or PNG,
 * and the offline page that holds the whole document and a viewer. Core draws
 * all three; this file only turns an SVG into pixels and names the files.
 */
import { isMapLike, mapPicture, offlinePage, picture, type Graph, type OperationMap } from "@grooph/core";
import type { PictureLook } from "@grooph/core/themes";

export type KeepTheme = "light" | "dark";

/** What `VERSION` in the CLI says: the grooph that made the file. */
export const APP_VERSION = "0.3.0";

const isMap = (doc: Graph | OperationMap): doc is OperationMap => isMapLike(doc);

/** `look` is the picture's theme when it is not Paper (docs/themes.md); without one each of these is what it always was. */
export const pictureSvg = (doc: Graph | OperationMap, theme: KeepTheme, look?: PictureLook): string => {
  const options = { theme, ...(look ? { look } : {}) };
  return isMap(doc) ? mapPicture(doc, options) : picture(doc, options);
};

export const pictureName = (doc: Graph | OperationMap, theme: KeepTheme, ext: "svg" | "png", look?: PictureLook): string => `${doc.id || "graph"}.${look ? `${look.name}-` : ""}${theme}.${ext}`;

export const pageHtml = (doc: Graph | OperationMap, look?: PictureLook): string => offlinePage(doc, { version: APP_VERSION, ...(look ? { look } : {}) });

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
