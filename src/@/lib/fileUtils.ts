// ============================================================================
// Tiện ích đọc file người dùng tải lên.
// - Ảnh  -> base64 data URL (để Gemini OCR).
// - .txt -> đọc text thuần.
// Các định dạng phức tạp (pdf/docx) KHÔNG parse ở client — hướng dẫn người dùng
// chụp ảnh/ dán văn bản thay thế.
// ============================================================================

export const ACCEPT_IMAGE = 'image/*'
export const ACCEPT_TEXT = '.txt,text/plain'
/** input accept cho ô "tải tệp" tổng hợp (ảnh + txt). */
export const ACCEPT_UPLOAD = 'image/*,.txt,text/plain'

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export function isTextFile(file: File): boolean {
  return (
    file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')
  )
}

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'))
    reader.readAsDataURL(file)
  })
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string) ?? '')
    reader.onerror = () => reject(new Error('Không đọc được tệp văn bản.'))
    reader.readAsText(file)
  })
}

export interface ReadFileResult {
  kind: 'image' | 'text' | 'unsupported'
  /** data URL nếu là ảnh */
  imageBase64?: string
  /** nội dung nếu là .txt */
  text?: string
  fileName: string
}

/** Đọc file bất kỳ, phân loại ảnh / txt / không hỗ trợ. */
export async function readUploadedFile(file: File): Promise<ReadFileResult> {
  if (isImageFile(file)) {
    return {
      kind: 'image',
      imageBase64: await readImageAsDataUrl(file),
      fileName: file.name,
    }
  }
  if (isTextFile(file)) {
    return { kind: 'text', text: await readTextFile(file), fileName: file.name }
  }
  return { kind: 'unsupported', fileName: file.name }
}
