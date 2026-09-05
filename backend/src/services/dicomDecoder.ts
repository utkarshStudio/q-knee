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

function findTag(dcmBuf: Buffer, group: number, element: number, pixelOffset: number): number | null {
  for (let i = 0; i < pixelOffset; i++) {
    if (
      dcmBuf[i] === (group & 0xff) &&
      dcmBuf[i + 1] === ((group >> 8) & 0xff) &&
      dcmBuf[i + 2] === (element & 0xff) &&
      dcmBuf[i + 3] === ((element >> 8) & 0xff)
    ) {
      const isExplicitVR = dcmBuf[i + 4] >= 0x41 && dcmBuf[i + 4] <= 0x5A;
      
      if (isExplicitVR) {
        const vrStr = dcmBuf.toString('ascii', i + 4, i + 6);
        if (vrStr === 'US' || vrStr === 'SS') return dcmBuf.readUInt16LE(i + 8);
        if (vrStr === 'IS') {
          const len = dcmBuf.readUInt16LE(i + 6);
          return parseInt(dcmBuf.toString('ascii', i + 8, i + 8 + len).trim(), 10);
        }
        if (vrStr === 'DS') {
          const len = dcmBuf.readUInt16LE(i + 6);
          return parseFloat(dcmBuf.toString('ascii', i + 8, i + 8 + len).trim().split('\\')[0]);
        }
      } else {
        // Implicit VR
        const len = dcmBuf.readUInt32LE(i + 4);
        if (group === 0x0028 && (element === 0x0010 || element === 0x0011 || element === 0x0100)) {
          return dcmBuf.readUInt16LE(i + 8); // Rows, Columns, BitsAllocated are US
        }
        if (group === 0x0028 && element === 0x0008) {
          return parseInt(dcmBuf.toString('ascii', i + 8, i + 8 + len).trim(), 10); // Frames is IS
        }
        if (group === 0x0028 && (element === 0x1050 || element === 0x1051 || element === 0x1052 || element === 0x1053)) {
          return parseFloat(dcmBuf.toString('ascii', i + 8, i + 8 + len).trim().split('\\')[0]); // Window/Rescale are DS
        }
        return dcmBuf.readUInt16LE(i + 8);
      }
    }
  }
  return null;
}

export function decodeDicomToPng(dcmBuf: Buffer, frameIndex: number = 0): Buffer | null {
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
    
    // Parse structural metadata
    const width = findTag(dcmBuf, 0x0028, 0x0011, pixelOffset) || 128;
    const height = findTag(dcmBuf, 0x0028, 0x0010, pixelOffset) || width;
    const bitsAllocated = findTag(dcmBuf, 0x0028, 0x0100, pixelOffset) || 16;
    const framesStr = findTag(dcmBuf, 0x0028, 0x0008, pixelOffset); // Number of Frames (IS)
    const frames = framesStr ? Number(framesStr) : 1;
    
    // Window Leveling tags
    const rescaleIntercept = findTag(dcmBuf, 0x0028, 0x1052, pixelOffset) || 0; // DS
    const rescaleSlope = findTag(dcmBuf, 0x0028, 0x1053, pixelOffset) || 1; // DS
    let windowCenter = findTag(dcmBuf, 0x0028, 0x1050, pixelOffset); // DS
    let windowWidth = findTag(dcmBuf, 0x0028, 0x1051, pixelOffset); // DS

    const bytesPerPixel = Math.ceil(bitsAllocated / 8);
    const frameSize = width * height * bytesPerPixel;
    let offset = Math.min(frameIndex, Math.max(1, frames) - 1) * frameSize;
    
    // Extract pixel buffer for the specific frame
    const pixelBytes = dcmBuf.subarray(dataStart + offset, dataStart + offset + frameSize);
    if (pixelBytes.length === 0) return null;

    let pixels8: Buffer = Buffer.alloc(width * height);

    if (bytesPerPixel === 2) {
      // Avoid out of bounds if file is truncated
      const safeLength = Math.floor(pixelBytes.length / 2) * 2;
      const raw16 = new Int16Array(pixelBytes.buffer, pixelBytes.byteOffset, safeLength / 2);
      
      // Calculate min/max if Windowing is not explicitly provided
      let min = 65535;
      let max = -65535;
      for (let i = 0; i < raw16.length; i++) {
        const val = raw16[i] * rescaleSlope + rescaleIntercept;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      
      if (windowCenter === null || windowWidth === null) {
        windowCenter = (max + min) / 2;
        windowWidth = max - min || 1;
      }
      
      const lower = windowCenter - 0.5 - (windowWidth - 1) / 2;
      const upper = windowCenter - 0.5 + (windowWidth - 1) / 2;
      
      for (let i = 0; i < raw16.length; i++) {
        let val = raw16[i] * rescaleSlope + rescaleIntercept;
        if (val <= lower) {
          pixels8[i] = 0;
        } else if (val >= upper) {
          pixels8[i] = 255;
        } else {
          pixels8[i] = Math.round(((val - lower) / (upper - lower)) * 255);
        }
      }
    } else {
      // 8-bit pixels fallback
      pixels8 = Buffer.from(pixelBytes.subarray(0, width * height));
    }

    return encodeGrayscalePng(pixels8, width, height);
  } catch (err) {
    console.warn('[dicomDecoder] Failed to decode DICOM:', err);
    return null;
  }
}
