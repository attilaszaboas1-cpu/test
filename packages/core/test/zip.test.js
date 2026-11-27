const test = require('node:test');
const assert = require('node:assert');
const Zip = require('../zip.js');

// Reads a ZIP with zlib (independent of the writer) and returns { name: { method, data } }.
function readZip(zip) {
  const zlib = require('node:zlib');
  const buf = Buffer.from(zip);
  const out = {};
  const end = buf.length - 22;
  assert.strictEqual(buf.readUInt32LE(end), 0x06054b50);
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    assert.strictEqual(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    assert.strictEqual(buf.readUInt32LE(off), 0x04034b50);
    assert.strictEqual(buf.readUInt16LE(off + 8), method, name + ': local/central method match');
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const body = buf.subarray(start, start + csize);
    const data = method === 8 ? zlib.inflateRawSync(body) : body;
    assert.strictEqual(data.length, usize, name + ' size');
    assert.strictEqual(zlib.crc32 ? zlib.crc32(data) : crc, crc, name + ' crc');
    out[name] = { method, data, csize };
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

test('makeZip deflates text and round-trips every file', async () => {
  const html = '<div class="l">hello banner</div>\n'.repeat(400);
  const random = new Uint8Array(4096).map((_, i) => (i * 2654435761) >>> 24); // incompressible-ish
  const zip = await Zip.makeZip([{ name: 'index.html', data: html }, { name: 'images/a.png', data: random }]);
  const files = readZip(zip);
  assert.deepStrictEqual(Object.keys(files), ['index.html', 'images/a.png']);
  assert.strictEqual(files['index.html'].method, 8, 'html is deflated');
  assert.ok(files['index.html'].csize < html.length / 10, 'repetitive html shrinks a lot');
  assert.strictEqual(files['index.html'].data.toString('utf8'), html);
  assert.deepStrictEqual(new Uint8Array(files['images/a.png'].data), random);
  assert.ok(zip.length < html.length, 'zip is smaller than the html alone');
});

test('makeZip stores files that deflate cannot shrink, and store mode stores everything', async () => {
  const tiny = new Uint8Array([1, 2, 3]);
  const files = readZip(await Zip.makeZip([{ name: 'x.bin', data: tiny }]));
  assert.strictEqual(files['x.bin'].method, 0);
  const stored = readZip(await Zip.makeZip([{ name: 'a.txt', data: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }], { store: true }));
  assert.strictEqual(stored['a.txt'].method, 0);
});

test('crc32 matches the standard check value', () => {
  assert.strictEqual(Zip.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('empty archive is valid', async () => {
  const zip = await Zip.makeZip([]);
  assert.strictEqual(zip.length, 22);
  assert.deepStrictEqual(readZip(zip), {});
});

module.exports = { readZip };
