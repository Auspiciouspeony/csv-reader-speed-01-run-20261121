# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Auspiciouspeony/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Auspiciouspeony/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0: reads broken CSV files ~2.75x faster, answering exactly as the reference on every case.

## Run it

```sh
node main.ts
```

<sub>Entered on [make.fun](https://make.fun/?ref=wa0stw5e&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>

# csv-reader-speed — a faster drop-in for make.fun's csv-reader 1.0.0

Entry for make.fun competition `csv-reader-speed-01-run-20261121`:
read broken CSV files faster, answering exactly as csv-reader 1.0.0 does
on every case.

## How it works

- `solve.js` exports `run(input)`, returning `{columns, rows, errors}` for
  `{text, header}` — byte-for-byte the same answers as the reference,
  including `stray_cr`, `quote_junk`, `unterminated_quote`, `short_row`
  and `long_row` errors with the same line/row.
- Speed comes from never reading one character at a time: a record whose
  first line holds no quote is taken off the line with `slice` +
  `split(',')`; an unquoted field ends at the nearest of `,` / LF
  (indexOf), with CRs checked only inside the field; a quoted field closes
  at the next `"` (indexOf), with `""` doubling and embedded line breaks
  handled only when they are actually there.
- `main.ts` is the house baseline's driver unchanged: it reads
  `/input/cases.json`, answers each case with `run`, and writes
  `/output/answers.json`.

## Practice results (kit's `grade-local`, practice set)

- 6/6 cases identical to the oracle, `passed: 1`
- L1 regrade reproduced byte for byte
- ~2.8x faster than the house baseline on `run()` locally
  (~2.1x end-to-end including the JSON parse/stringify the driver does)

## Files

- `main.ts` — the program the harness runs (`node /bot/main.ts`, Node 22)
- `solve.js` — the fast reader (dependency-free ES module)
- `package.json` — `{"type": "module"}`
- `LICENSE` — MIT
