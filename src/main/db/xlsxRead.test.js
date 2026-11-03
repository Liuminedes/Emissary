import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { readXlsxRows } from './xlsxRead.js';

const xlsx = (sheet, shared = []) => Buffer.from(zipSync({
  'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Datos" sheetId="1" r:id="rId9"/></sheets></workbook>'),
  'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Target="worksheets/hoja2.xml" Id="rId9"/></Relationships>'),
  'xl/sharedStrings.xml': strToU8(`<sst>${shared.map((s) => (s === null ? '<si/>' : `<si><t>${s}</t></si>`)).join('')}</sst>`),
  'xl/worksheets/hoja2.xml': strToU8(`<worksheet><sheetData>${sheet}</sheetData></worksheet>`),
}));

test('lee textos compartidos, números, texto en línea y huecos', () => {
  const buf = xlsx(
    '<row r="1"><c r="A1" t="s"><v>1</v></c><c r="C1"><v>59990000</v></c></row>' +
    '<row r="2"/>' +
    '<row r="4"><c r="B4" t="inlineStr"><is><t>a &amp; b</t></is></c><c r="D4" t="b"><v>1</v></c></row>',
    [null, 'Año Modelo'], // una cadena vacía <si/> no debe correr los índices
  );
  assert.deepEqual(readXlsxRows(buf).map((r) => Array.from(r)), [['Año Modelo', undefined, 59990000], [], [], [undefined, 'a & b', undefined, true]]);
});

test('toma la hoja que indica el libro, no una fija', () => {
  assert.equal(readXlsxRows(xlsx('<row r="1"><c r="A1"><v>7</v></c></row>'))[0][0], 7);
});

test('un archivo que no es xlsx da un error claro o falla sin colgarse', () => {
  assert.throws(() => readXlsxRows(Buffer.from('esto no es un excel')));
});
