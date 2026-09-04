import zlib from 'zlib';

/**
 * Pure Node.js zero-dependency DICOM-to-PNG decoder and encoder.
 * Allows the Backend service to decode uploaded DICOM pixel data directly
 * into high-fidelity PNG images without depending on external Python/ML services
 * or cross-container filesystem mounts.
 */

function crc32(buf: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

export function encodeGrayscalePng(pixels: Buffer, width: number, height: number): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(0, 9); // color type 0 (grayscale)
  ihdrData.writeUInt8(0, 10); // compression method 0
  ihdrData.writeUInt8(0, 11); // filter method 0
  ihdrData.writeUInt8(0, 12); // interlace method 0
  const ihdr = makePngChunk('IHDR', ihdrData);

  // Scanlines: width + 1 byte filter (0 = None) per line
  const rawScanlines = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y++) {
    rawScanlines[y * (width + 1)] = 0; // Filter 0: None
    for (let x = 0; x < width; x++) {
      rawScanlines[y * (width + 1) + 1 + x] = pixels[y * width + x];
    }
  }

  const idat = makePngChunk('IDAT', zlib.deflateSync(rawScanlines));
  const iend = makePngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

export function decodeDicomToPng(dcmBuf: Buffer): Buffer | null {
  try {
    // 1. Locate PixelData tag (0x7FE0, 0x0010) in little-endian format: [0xE0, 0x7F, 0x10, 0x00]
    let pixelOffset = -1;
    for (let i = 0; i < dcmBuf.length - 8; i++) {
      if (
        dcmBuf[i] === 0xE0 &&
        dcmBuf[i + 1] === 0x7F &&
        dcmBuf[i + 2] === 0x10 &&
        dcmBuf[i + 3] === 0x00
      ) {
        pixelOffset = i;
        break;
      }
    }

    if (pixelOffset === -1) {
      return null;
    }

    // 2. Read VR and Length
    const vr = dcmBuf.toString('ascii', pixelOffset + 4, pixelOffset + 6);
    let dataStart = pixelOffset + 8;
    let dataLen = dcmBuf.readUInt32LE(pixelOffset + 4);

    if (vr === 'OW' || vr === 'OB' || vr === 'UN') {
      dataStart = pixelOffset + 12;
      dataLen = dcmBuf.readUInt32LE(pixelOffset + 8);
    }

    if (dataLen === 0xFFFFFFFF || dataStart + dataLen > dcmBuf.length) {
      dataLen = dcmBuf.length - dataStart;
    }

    const pixelBytes = dcmBuf.subarray(dataStart, dataStart + dataLen);
    if (pixelBytes.length === 0) return null;

    // Check if 16-bit or 8-bit pixels
    let width = 128;
    let height = 128;
    const numPixels16 = Math.floor(pixelBytes.length / 2);
    const numPixels8 = pixelBytes.length;

    let pixels8: Buffer;

    if (numPixels16 >= 64 * 64) {
      const dim = Math.round(Math.sqrt(numPixels16));
      if (dim * dim === numPixels16) {
        width = dim;
        height = dim;
      }
      const raw16 = new Uint16Array(
        pixelBytes.buffer,
        pixelBytes.byteOffset,
        width * height
      );
      let min = 65535;
      let max = 0;
      for (let i = 0; i < raw16.length; i++) {
        if (raw16[i] < min) min = raw16[i];
        if (raw16[i] > max) max = raw16[i];
      }
      const diff = max > min ? max - min : 1;
      pixels8 = Buffer.alloc(width * height);
      for (let i = 0; i < raw16.length; i++) {
        pixels8[i] = Math.round(((raw16[i] - min) / diff) * 255);
      }
    } else {
      const dim = Math.round(Math.sqrt(numPixels8));
      if (dim * dim === numPixels8) {
        width = dim;
        height = dim;
      }
      pixels8 = Buffer.from(pixelBytes.subarray(0, width * height));
    }

    return encodeGrayscalePng(pixels8, width, height);
  } catch (err) {
    console.warn('[dicomDecoder] Failed to decode DICOM:', err);
    return null;
  }
}
