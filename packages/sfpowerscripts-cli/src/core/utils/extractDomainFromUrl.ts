/**
 * Extracts domain name from full URL string
 * @param url
 * @returns
 */
export default function extractDomainFromUrl(url: string): string {
    if (!url) return url;
    const matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
    return matches && matches[1];
}
