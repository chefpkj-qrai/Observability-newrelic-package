export function scrub<T = any>(
  obj: T,
  { maxLen = 400, redactKeys = ['password', 'token', 'secret', 'email', 'phone', 'otp'] } = {},
): any {
  try {
    const clone = JSON.parse(JSON.stringify(obj ?? {}))
    ;(function walk(o: any) {
      Object.keys(o).forEach((k) => {
        const v = o[k]
        if (redactKeys.some((rk) => k.toLowerCase().includes(rk))) {
          o[k] = '[REDACTED]'
        } else if (v && typeof v === 'object') {
          walk(v)
        } else if (typeof v === 'string' && v.length > maxLen) {
          o[k] = `${v.slice(0, maxLen)}…`
        }
      })
    })(clone)
    return clone
  } catch {
    return { preview: `${String(obj).slice(0, maxLen)}…` }
  }
}
