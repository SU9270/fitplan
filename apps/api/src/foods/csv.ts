/**
 * Minimal RFC 4180 CSV reader (FoodData Central downloads quote every field and escape quotes
 * by doubling them). Accepts LF or CRLF line ends and newlines inside quoted fields. Rows are
 * yielded one at a time so a large file never becomes one big array of arrays.
 */
export function* csvRows(text: string): Generator<string[]> {
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; // skip a UTF-8 BOM

  for (; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      yield row;
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (quoted) throw new Error('CSV ends inside a quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    yield row;
  }
}

/**
 * Rows as objects keyed by the header row, so callers read columns by name, not position.
 * Blank lines are skipped; a row with a different field count than the header is an error.
 */
export function* csvRecords(text: string): Generator<Record<string, string>> {
  const rows = csvRows(text);
  const first = rows.next();
  if (first.done) return;
  const header = first.value;
  let index = 1;
  for (const row of rows) {
    index += 1;
    if (row.length === 1 && row[0] === '') continue;
    if (row.length !== header.length) {
      throw new Error(`CSV record ${index} has ${row.length} fields, expected ${header.length}`);
    }
    const record: Record<string, string> = {};
    header.forEach((name, index) => {
      record[name] = row[index] ?? '';
    });
    yield record;
  }
}
