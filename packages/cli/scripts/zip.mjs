/**
 * A zip archive, written with what Node has: enough for a skill folder and a desktop
 * extension, and no more. Entries are stored in the order given with one fixed date, so
 * the same files give the same bytes. No dependency.
 */

import { deflateRawSync } from "node:zlib";

const TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 2026-01-01 00:00, in the two 16-bit fields the format has for a time and a date.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/** `entries`: [{ name: "folder/file.txt", data: Buffer, mode?: 0o644 }], names with forward slashes. Returns the archive. */
export function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const { name, data, mode = 0o644 } of entries) {
    if (name.startsWith("/") || name.split("/").includes("..")) throw new Error(`a zip entry must be a relative path inside the archive: ${name}`);
    const nameBytes = Buffer.from(name, "utf8");
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // names are UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE((3 << 8) | 20, 4); // made on Unix, so the mode below is read
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(DOS_TIME, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(((0o100000 | mode) << 16) >>> 0, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
