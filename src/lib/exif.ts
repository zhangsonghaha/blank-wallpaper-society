import sharp from "sharp";

export interface ExifData {
  camera?: string; // Make + Model
  lens?: string;
  focalLength?: number;
  aperture?: number; // f-number
  shutterSpeed?: string;
  iso?: number;
  dateTaken?: string;
  gps?: { lat: number; lng: number };
  orientation?: number;
  software?: string;
}

/**
 * 从图片 Buffer 中提取 EXIF 数据
 * 使用 sharp 的 metadata() 方法，解析 IFD0/ExifIFD 中的信息
 */
export async function extractExif(buffer: Buffer): Promise<ExifData> {
  try {
    const metadata = await sharp(buffer).metadata();
    const exif = metadata.exif;

    if (!exif) {
      // 没有 EXIF 数据，从 metadata 基础信息中提取
      const result: ExifData = {};
      if (metadata.orientation) {
        result.orientation = metadata.orientation;
      }
      return result;
    }

    // 解析 EXIF 数据（sharp 返回的是对象格式）
    const parsed = parseExifData(exif);
    return parsed;
  } catch (error) {
    console.warn("EXIF 提取失败:", error);
    return {};
  }
}

/**
 * 解析 sharp 返回的 EXIF 数据
 * sharp 的 metadata().exif 返回的是一个对象，包含 IFD0, ExifIFD, GPSIFD 等
 */
function parseExifData(exif: Record<string, any>): ExifData {
  const result: ExifData = {};

  const ifd0 = exif.IFD0 || exif.ifd0 || {};
  const exifIfd = exif.ExifIFD || exif.exifIFD || exif.ExifIFD || {};
  const gpsIfd = exif.GPSIFD || exif.gpsIFD || {};

  // 相机信息
  const make = ifd0.Make || ifd0.make || "";
  const model = ifd0.Model || ifd0.model || "";
  if (make && model) {
    result.camera = `${make} ${model}`.trim();
  } else if (model) {
    result.camera = model;
  } else if (make) {
    result.camera = make;
  }

  // 镜头
  result.lens = exifIfd.LensModel || exifIfd.lensModel || ifd0.LensModel || ifd0.lensModel || undefined;

  // 焦距
  const focalLength = exifIfd.FocalLength || exifIfd.focalLength;
  if (focalLength !== undefined && focalLength !== null) {
    result.focalLength = typeof focalLength === "number" ? focalLength : parseFloat(String(focalLength));
  }

  // 光圈 (f-number)
  const fNumber = exifIfd.FNumber || exifIfd.fNumber;
  if (fNumber !== undefined && fNumber !== null) {
    result.aperture = typeof fNumber === "number" ? fNumber : parseFloat(String(fNumber));
  }

  // 快门速度
  const exposureTime = exifIfd.ExposureTime || exifIfd.exposureTime;
  if (exposureTime !== undefined && exposureTime !== null) {
    result.shutterSpeed = formatShutterSpeed(exposureTime);
  }

  // ISO
  const iso = exifIfd.ISO || exifIfd.ISOSpeedRatings || exifIfd.iso || exifIfd.isoSpeedRatings;
  if (iso !== undefined && iso !== null) {
    result.iso = typeof iso === "number" ? iso : parseInt(String(iso), 10);
  }

  // 拍摄日期
  const dateTaken = exifIfd.DateTimeOriginal || exifIfd.dateTimeOriginal || ifd0.DateTime || ifd0.dateTime;
  if (dateTaken) {
    result.dateTaken = formatExifDate(String(dateTaken));
  }

  // GPS
  const gpsLat = gpsIfd.GPSLatitude;
  const gpsLatRef = gpsIfd.GPSLatitudeRef;
  const gpsLng = gpsIfd.GPSLongitude;
  const gpsLngRef = gpsIfd.GPSLongitudeRef;

  if (gpsLat && gpsLng) {
    const lat = convertGpsCoordinate(gpsLat, gpsLatRef);
    const lng = convertGpsCoordinate(gpsLng, gpsLngRef);
    if (lat !== null && lng !== null) {
      result.gps = { lat, lng };
    }
  }

  // 方向
  const orientation = ifd0.Orientation || ifd0.orientation;
  if (orientation) {
    result.orientation = typeof orientation === "number" ? orientation : parseInt(String(orientation), 10);
  }

  // 软件
  result.software = ifd0.Software || ifd0.software || undefined;

  return result;
}

/**
 * 格式化快门速度
 */
function formatShutterSpeed(exposureTime: number | string): string {
  const val = typeof exposureTime === "number" ? exposureTime : parseFloat(exposureTime);
  if (isNaN(val)) return String(exposureTime);

  if (val >= 1) {
    return `${Math.round(val)}s`;
  }

  // 找到最接近的常见快门速度分母
  const denominator = Math.round(1 / val);
  if (denominator > 0) {
    return `1/${denominator}s`;
  }

  return `${val}s`;
}

/**
 * 格式化 EXIF 日期 (如 "2024:01:15 14:30:00" -> "2024-01-15 14:30:00")
 */
function formatExifDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  // EXIF 日期格式: YYYY:MM:DD HH:MM:SS
  const match = dateStr.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}`;
  }
  return dateStr;
}

/**
 * 转换 GPS 坐标
 * EXIF GPS 坐标格式为 [度, 分, 秒] 数组
 */
function convertGpsCoordinate(
  coords: number[] | string,
  ref?: string
): number | null {
  try {
    let degrees: number, minutes: number, seconds: number;

    if (Array.isArray(coords)) {
      [degrees, minutes, seconds] = coords;
    } else {
      return null;
    }

    let decimal = degrees + minutes / 60 + seconds / 3600;

    // S 或 W 为负值
    if (ref === "S" || ref === "W") {
      decimal = -decimal;
    }

    return decimal;
  } catch {
    return null;
  }
}

/**
 * 将 EXIF 数据格式化为可读的描述文本
 */
export function formatExifDescription(exif: ExifData): string {
  const parts: string[] = [];

  if (exif.camera) parts.push(`📷 ${exif.camera}`);
  if (exif.lens) parts.push(`🔍 ${exif.lens}`);
  if (exif.focalLength) parts.push(`焦距 ${exif.focalLength}mm`);
  if (exif.aperture) parts.push(`f/${exif.aperture}`);
  if (exif.shutterSpeed) parts.push(exif.shutterSpeed);
  if (exif.iso) parts.push(`ISO ${exif.iso}`);
  if (exif.dateTaken) parts.push(`📅 ${exif.dateTaken}`);

  return parts.join(" · ");
}