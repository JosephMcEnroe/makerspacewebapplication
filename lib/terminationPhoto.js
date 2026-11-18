export const MAX_TERMINATION_PHOTO_BYTES = 3 * 1024 * 1024;

export function terminationPhotoType(bytes) {
  if (!bytes) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "image/png";
  if (bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) return "image/jpeg";
  if (bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF"
    && bytes.toString("ascii", 8, 12) === "WEBP"
    && ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16))) return "image/webp";
  return null;
}

export function decodeTerminationPhoto(value, expectedType) {
  if (value == null) return null;
  if (typeof value !== "string" || value.length > MAX_TERMINATION_PHOTO_BYTES * 4 / 3) {
    throw new Error("The photo must be 3 MiB or smaller.");
  }
  const bytes = Buffer.from(value, "base64");
  const type = terminationPhotoType(bytes);
  if (bytes.toString("base64") !== value || !type || type !== expectedType) {
    throw new Error("Choose a PNG, JPEG, or WebP photo.");
  }
  return bytes;
}
