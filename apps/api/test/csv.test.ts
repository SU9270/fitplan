import { describe, expect, it } from 'vitest';
import { csvRecords, csvRows } from '../src/foods/csv';

describe('csvRows', () => {
  it('reads quoted fields, doubled quotes, commas and newlines inside quotes', () => {
    const text = '"id","modifier"\n"1","pat (1"" sq, 1/3"" high)"\n"2","line one\nline two"\n';
    expect([...csvRows(text)]).toEqual([
      ['id', 'modifier'],
      ['1', 'pat (1" sq, 1/3" high)'],
      ['2', 'line one\nline two'],
    ]);
  });

  it('accepts CRLF, unquoted and empty fields, a BOM and no trailing newline', () => {
    expect([...csvRows('﻿a,b,c\r\n1,,"3"\r\n4,5,6')]).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('rejects an unterminated quote', () => {
    expect(() => [...csvRows('"a,b\n')]).toThrow(/quoted field/);
  });
});

describe('csvRecords', () => {
  it('keys fields by the header and skips blank lines', () => {
    expect([...csvRecords('"fdc_id","amount"\n"167512","31.02"\n\n"167513",""\n')]).toEqual([
      { fdc_id: '167512', amount: '31.02' },
      { fdc_id: '167513', amount: '' },
    ]);
  });

  it('rejects rows with the wrong number of fields', () => {
    expect(() => [...csvRecords('a,b\n1,2,3\n')]).toThrow(/3 fields, expected 2/);
  });
});
