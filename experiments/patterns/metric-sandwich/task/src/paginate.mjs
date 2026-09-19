/**
 * Pagination helpers for lists held in memory.
 *
 * Page numbers in this module are zero-based: page 0 is the first page.
 */

/**
 * Returns the items on one page of `items`.
 *
 * @param {unknown[]} items the whole list
 * @param {number} pageSize how many items a page holds
 * @param {number} page which page, counting from 0
 * @returns {unknown[]} the items on that page; empty past the last page
 */
export function paginate(items, pageSize, page) {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}
