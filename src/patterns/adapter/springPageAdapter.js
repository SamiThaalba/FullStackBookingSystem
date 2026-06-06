/**
 * Converts a Spring Page response object into a flat array of rows
 * compatible with table/list components.
 */
export function toPageContentRows(page) {
    if (!page) return [];
    // Spring Page wraps content in a "content" array
    if (Array.isArray(page.content)) return page.content;
    // Fallback: if it's already an array
    if (Array.isArray(page)) return page;
    return [];
}