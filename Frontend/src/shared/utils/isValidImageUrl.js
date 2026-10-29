export default function isValidImageUrl(value) {
  try {
    const url = new URL(String(value).trim())
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.toString().length <= 2000
  } catch {
    return false
  }
}
