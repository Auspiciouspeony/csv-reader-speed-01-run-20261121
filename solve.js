// Fast drop-in for make.fun's csv-reader 1.0.0.
//
// Same answers, same errors, same order — reached the fast way:
//   - most records hold no quote at all, so a whole record is taken off one
//     line with slice + split(',') instead of one character at a time;
//   - unquoted fields end at the nearest of ',' / '\n' (indexOf, memchr-fast),
//     with CRs checked only inside the field (bounded scans, never past it);
//   - quoted fields close at the next '"' (indexOf), doubling and line breaks
//     handled only when they are actually there.
// The slow paths below mirror csv-reader 1.0.0's policy exactly, including
// stray_cr, quote_junk, unterminated_quote, short_row and long_row, and the
// line each record starts on. Pure: nothing kept from one call to the next.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `value` up to the next comma or line break:
  // a CR not followed by LF is dropped (stray_cr). Returns the field and how it ended.
  function readUnquoted(value) {
    for (;;) {
      const c = text.indexOf(',', pos);
      const l = text.indexOf('\n', pos);
      let end;
      let isComma;
      let isEnd = false;
      if (c === -1 && l === -1) {
        end = n;
        isComma = false;
        isEnd = true;
      } else if (l === -1 || (c !== -1 && c < l)) {
        end = c;
        isComma = true;
      } else {
        end = l;
        isComma = false;
      }
      if (end > pos) {
        const f = text.slice(pos, end);
        const r = f.indexOf('\r');
        if (r !== -1) {
          if (!isComma && !isEnd && r === f.length - 1) {
            // A clean CRLF: the field ends here.
            value += f.slice(0, r);
            pos = end + 1;
            line += 1;
            return { value, ended: LINE_BREAK };
          }
          // A stray CR inside this field: dropped, and the field goes on.
          value += f.slice(0, r);
          error('stray_cr');
          pos += r + 1;
          continue;
        }
        value += f;
      }
      if (isEnd) {
        pos = n;
        return { value, ended: END };
      }
      if (isComma) {
        pos = end + 1;
        return { value, ended: COMMA };
      }
      pos = end + 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos = open + 1;
    let pieces = null;
    let seg = pos;
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        error('unterminated_quote');
        return readUnquoted('"');
      }
      if (text.charCodeAt(q + 1) === 34) {
        // "" inside a quoted field is one quote.
        if (pieces === null) pieces = [];
        pieces.push(text.slice(seg, q));
        pieces.push('"');
        pos = q + 2;
        seg = pos;
        continue;
      }
      // Closed at q.
      let value;
      if (pieces === null) {
        value = text.slice(seg, q);
      } else {
        pieces.push(text.slice(seg, q));
        value = pieces.join('');
      }
      // Each CRLF or lone CR inside quotes reads as LF, and each counts a line.
      if (value.indexOf('\r') !== -1) {
        value = value.replace(/\r\n?/g, '\n');
      }
      // Count the line breaks the quoted field held.
      let idx = -1;
      let breaks = 0;
      while ((idx = value.indexOf('\n', idx + 1)) !== -1) breaks += 1;
      line += breaks;
      pos = q + 1;
      if (pos >= n) return { value, ended: END };
      const ch = text.charCodeAt(pos);
      if (ch === 44) {
        pos += 1;
        return { value, ended: COMMA };
      }
      if (ch === 10) {
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      if (ch === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      // What follows the closing quote is appended as it stands, up to the
      // next comma or line break.
      const before = value.length;
      const junk = readUnquoted(value);
      if (junk.value.length > before) error('quote_junk');
      return junk;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: the record's first line holds no quote and no stray CR, so no
    // field on it is quoted and the record ends at that line's break.
    const le = text.indexOf('\n', pos);
    const hasNL = le !== -1;
    const lineEnd = hasNL ? le : n;
    let segEnd = lineEnd;
    if (hasNL && lineEnd > pos && text.charCodeAt(lineEnd - 1) === 13) segEnd = lineEnd - 1;
    const seg = text.slice(pos, segEnd);
    let fields;
    let quoted = false;
    if (seg.indexOf('"') === -1 && seg.indexOf('\r') === -1) {
      fields = seg.split(',');
      pos = hasNL ? lineEnd + 1 : n;
      if (hasNL) line += 1;
    } else {
      fields = [];
      let field;
      do {
        quoted = text.charCodeAt(pos) === 34;
        field = quoted ? readQuoted() : readUnquoted('');
        fields.push(field.value);
      } while (field.ended === COMMA);
    }

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
