const SIZES = {
  a3: { width: 297, height: 420 },
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
};

/**
 * The width and height of a paper size in millimeters, portrait.
 * @param {string} name A3, A4, A5, letter or legal, in any letter case
 */
export function paperSize(name) {
  if (typeof name !== "string") throw new TypeError("paperSize: name must be a string");
  const size = SIZES[name.toLowerCase()];
  if (!size) throw new RangeError(`paperSize: unknown paper size "${name}"`);
  return { ...size };
}
