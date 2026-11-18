import sharp from "sharp";
export async function safeImage(value: unknown) {
  if (value === "" || value === null) return null;
  if (
    typeof value !== "string" ||
    value.length > 360000 ||
    !/^data:image\/(png|jpeg|webp);base64,/.test(value)
  )
    throw Error("Choose a PNG, JPEG or WebP image smaller than 256 KB.");
  const bytes = Buffer.from(value.split(",")[1], "base64");
  if (bytes.length > 262144) throw Error("Image must be smaller than 256 KB.");
  const output = await sharp(bytes, {
    limitInputPixels: 16000000,
    animated: false,
  })
    .rotate()
    .resize(256, 256, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return "data:image/webp;base64," + output.toString("base64");
}
