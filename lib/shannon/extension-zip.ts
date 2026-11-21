import { readdir, readFile } from "fs/promises";
import path from "path";

const EXTENSION_DIR = path.join(process.cwd(), "extension");

export async function buildExtensionZip(origin: string): Promise<Buffer> {
  const safe = origin.replace(/\/$/, "");
  if (!/^https?:\/\/[^/\s]+(?::\d+)?$/i.test(safe)) {
    throw new Error("Shannon address is not a public http origin");
  }
  const files = await listFiles(EXTENSION_DIR);
  const entries = await Promise.all(
    files.map(async (name) => {
      let data = await readFile(path.join(EXTENSION_DIR, name));
      if (name === "defaults.js") data = Buffer.from(stampOrigin(data.toString("utf8"), safe));
      return { name: name.split(path.sep).join("/"), data };
    }),
  );
  return zipStore(entries);
}

export function stampOrigin(source: string, origin: string): string {
  const next = source.replace(
    /globalThis\.SHANNON_ORIGIN\s*=\s*(?:""|'');/,
    `globalThis.SHANNON_ORIGIN = ${JSON.stringify(origin)};`,
  );
  if (next === source) throw new Error("defaults.js is missing SHANNON_ORIGIN");
  return next;
}

async function listFiles(dir: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? path.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) names.push(...(await listFiles(path.join(dir, entry.name), rel)));
    else names.push(rel);
  }
  return names.sort();
}

function zipStore(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const crc = crc32(file.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    locals.push(local, file.data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + file.data.length;
  }
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, end]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
