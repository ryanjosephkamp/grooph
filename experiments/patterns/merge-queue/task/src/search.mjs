/**
 * Finds the items whose title contains the query. Exact title matches come
 * first, then the rest in their original order.
 */
export function search(items, query) {
  const exact = items.filter((item) => item.title === query);
  const partial = items.filter((item) => item.title !== query && item.title.includes(query));
  return [...exact, ...partial];
}
