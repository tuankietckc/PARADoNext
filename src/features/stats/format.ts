/** Phút → chữ gọn: 45 → "45p", 90 → "1,5g", 720 → "12g" */
export const fmtMin = (m: number) => (m >= 60 ? `${String(+(m / 60).toFixed(m >= 600 ? 0 : 1)).replace('.', ',')}g` : `${Math.round(m)}p`)
