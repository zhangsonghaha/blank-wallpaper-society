import sharp from "sharp";

/**
 * 计算 perceptual hash (pHash)
 * 算法：缩小8x8 → 灰度 → DCT → 取左上角8x8 → 二值化 → 64bit hash
 */
export async function computePHash(buffer: Buffer): Promise<string> {
  // 1. 缩小到 32x32 灰度图（用于 DCT 输入）
  const { data, info } = await sharp(buffer)
    .resize(32, 32, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Float64Array(32 * 32);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = data[i];
  }

  // 2. 对每行做 DCT
  const dctRows = new Float64Array(32 * 32);
  for (let y = 0; y < 32; y++) {
    const row = dct(pixels, y * 32, 32);
    for (let x = 0; x < 32; x++) {
      dctRows[y * 32 + x] = row[x];
    }
  }

  // 3. 对每列做 DCT
  const dct2d = new Float64Array(32 * 32);
  for (let x = 0; x < 32; x++) {
    const col = new Float64Array(32);
    for (let y = 0; y < 32; y++) {
      col[y] = dctRows[y * 32 + x];
    }
    const colDct = dct(col, 0, 32);
    for (let y = 0; y < 32; y++) {
      dct2d[y * 32 + x] = colDct[y];
    }
  }

  // 4. 取左上角 8x8 的 DCT 系数（低频部分）
  const lowFreq = new Float64Array(8 * 8);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      lowFreq[y * 8 + x] = dct2d[y * 32 + x];
    }
  }

  // 5. 计算均值（排除 DC 分量）
  let sum = 0;
  for (let i = 1; i < lowFreq.length; i++) {
    sum += lowFreq[i];
  }
  const avg = sum / (lowFreq.length - 1);

  // 6. 二值化：大于均值为1，否则为0
  let hashBits = "";
  for (let i = 0; i < lowFreq.length; i++) {
    hashBits += lowFreq[i] > avg ? "1" : "0";
  }

  // 7. 将 64bit 二进制转为 16 位十六进制字符串
  let hexHash = "";
  for (let i = 0; i < 64; i += 4) {
    const nibble = parseInt(hashBits.substring(i, i + 4), 2);
    hexHash += nibble.toString(16);
  }

  return hexHash;
}

/**
 * 一维 DCT-II 变换
 */
function dct(input: Float64Array, offset: number, length: number): Float64Array {
  const output = new Float64Array(length);
  const N = length;

  for (let k = 0; k < N; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += input[offset + n] * Math.cos((Math.PI * (2 * n + 1) * k) / (2 * N));
    }
    output[k] = sum;
  }

  return output;
}

/**
 * 计算 Hamming Distance（两个 pHash 之间的差异位数）
 * @returns 差异位数，0 表示完全相同，越小越相似
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return Infinity;
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const nibble1 = parseInt(hash1[i], 16);
    const nibble2 = parseInt(hash2[i], 16);
    const xor = nibble1 ^ nibble2;
    // 计算每个 hex 字符的 popcount
    distance += popcount(xor);
  }

  return distance;
}

/**
 * 计算整数中 1 的位数
 */
function popcount(n: number): number {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}