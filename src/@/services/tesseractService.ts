import Tesseract from 'tesseract.js'

/**
 * OCR DỰ PHÒNG (FALLBACK) — chạy hoàn toàn phía client bằng Tesseract.js.
 *
 * Được dùng khi Gemini OCR gặp lỗi/quá tải (429, 503, mất mạng…). Mục tiêu là
 * giữ cho luồng người dùng KHÔNG bị gián đoạn: vẫn trả về một chuỗi văn bản thô
 * để UI hiển thị, dù độ chính xác có thể thấp hơn Gemini.
 *
 * Ngôn ngữ: tiếng Việt (`vie`). Dữ liệu model được tải về từ CDN mặc định của
 * tesseract.js và được cache lại ở các lần gọi sau.
 */

/** Ngôn ngữ OCR mặc định (tiếng Việt). */
const OCR_LANG = 'vie'

/** Đầu vào ảnh mà Tesseract.js chấp nhận (File/Blob, Base64 data URL, hoặc URL). */
export type OcrImageInput = File | Blob | string

/**
 * Trích xuất văn bản thô từ MỘT ảnh bằng Tesseract.js (tiếng Việt).
 *
 * @param image  File ảnh, Blob, chuỗi Base64 (data URL) hoặc URL ảnh.
 * @returns      Văn bản thô đã trim (có thể rỗng nếu không nhận ra chữ nào).
 */
export async function ocrImageTesseract(image: OcrImageInput): Promise<string> {
  const result = await Tesseract.recognize(image, OCR_LANG)
  return (result.data.text ?? '').trim()
}

/**
 * Trích xuất và GỘP văn bản từ NHIỀU ảnh bằng Tesseract.js, theo đúng thứ tự.
 * Xử lý tuần tự để tránh tải song song nhiều worker nặng trên trình duyệt.
 *
 * @param images  Danh sách ảnh (File/Blob/Base64/URL) theo thứ tự.
 * @returns       Văn bản thô đã gộp, ngăn cách bằng dòng trống.
 */
export async function ocrImagesTesseract(
  images: OcrImageInput[]
): Promise<string> {
  const valid = images.filter(Boolean)
  if (valid.length === 0) return ''

  const chunks: string[] = []
  for (const img of valid) {
    const text = await ocrImageTesseract(img)
    if (text) chunks.push(text)
  }
  return chunks.join('\n\n').trim()
}
