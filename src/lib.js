export const vnd = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n || 0)

export const slugify = (s = '') =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const STATUS = {
  new: 'Mới',
  contacted: 'Đã liên hệ',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '')
