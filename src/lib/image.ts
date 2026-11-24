// ย่อรูปในเบราว์เซอร์ก่อนส่งให้ AI อ่าน (ส่งเร็วขึ้น, BE จำกัดขนาด body)

const MAX_SIDE = 1600; // px — ยังอ่านตัวเลขในบิลได้
const QUALITY = 0.85;

/** File → JPEG ที่ย่อแล้ว (หมุนตาม EXIF) เป็น base64 ไม่มี prefix data: */
export async function shrinkToBase64(file: File): Promise<{ mimeType: "image/jpeg"; data: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas not supported");
    ctx.fillStyle = "#fff"; // PNG โปร่งใส → พื้นขาว
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
    return { mimeType: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
  } finally {
    bitmap.close();
  }
}
