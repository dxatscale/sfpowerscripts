

/**
 * Split values in SOQL WHERE clause into chunks to avoid exceeding max. URI length (16,000 chars) or max. WHERE clause length (4000 chars)
 * @param collection values in SOQL WHERE clause
 * @param chunkSize default is 4000
 * @param offset offset to account for keywords, fields, operators and literals in the query. Default is 1000
 */
export default function chunkCollection(collection: string[], chunkSize: number = 4000, offset: number = 1000): string[][] {
  const result: string[][] = [];
  chunkSize = chunkSize - offset;

  let chunk: string[] = [];
  let numberOfCharsInChunk: number = 0;
  for (const elem of collection) {
    if (elem.length + 2 > chunkSize) {
      throw new Error(`Single value cannot exceed chunk size limit of ${chunkSize}`);
    }

    const commasAndQuotes = 2*(chunk.length+1) + chunk.length;
    if (numberOfCharsInChunk + elem.length +  commasAndQuotes <= chunkSize) {
      chunk.push(elem);
      numberOfCharsInChunk += elem.length;
    } else {
      result.push(chunk);

      // Create new chunk
      chunk = [];
      numberOfCharsInChunk = 0;
      chunk.push(elem);
      numberOfCharsInChunk += elem.length;
    }
  }

  result.push(chunk);

  return result;
}