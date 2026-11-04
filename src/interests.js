// Các "giấc mơ" (sở thích) dùng làm lối vào chính. Sản phẩm thuộc một sở thích khi
// thẻ trùng mã sở thích hoặc tên/thẻ chứa một từ khoá (không phân biệt dấu).
export const INTERESTS = [
  { slug: 'game', name: 'Game thủ', line: 'Keycap, giá đỡ, góc máy', color: '#7B6CFF', ink: '#fff', words: ['game', 'gamer', 'gaming', 'keycap', 'ban phim', 'tay cam', 'esport'] },
  { slug: 'anime', name: 'Anime & K-pop', line: 'Chibi, standee, đồ sưu tầm', color: '#FF8FB1', ink: '#3a0f24', words: ['anime', 'kpop', 'k-pop', 'idol', 'manga', 'chibi', 'standee'] },
  { slug: 'stem', name: 'Khoa học & STEM', line: 'Mô hình học mà chơi', color: '#7BE3CB', ink: '#07372c', words: ['stem', 'khoa hoc', 'robot', 'giao duc', 'mo hinh hoc', 'thi nghiem'] },
  { slug: 'hoc-tap', name: 'Góc học tập', line: 'Bàn học gọn, có gu', color: '#FFD166', ink: '#3b2a00', words: ['hoc tap', 'ban hoc', 'hop but', 'gia sach', 'van phong', 'desk'] },
  { slug: 'be-yeu', name: 'Bé yêu', line: 'Đồ chơi, quà thôi nôi', color: '#FF9E80', ink: '#401506', words: ['be yeu', 'tre em', 'do choi', 'em be', 'thoi noi', 'cho be'] },
  { slug: 'thu-cung', name: 'Thú cưng', line: 'Tượng và bảng tên', color: '#8BD3FF', ink: '#052a40', words: ['thu cung', 'cho', 'meo', 'pet'] },
  { slug: 'cosplay', name: 'Cosplay & mô hình', line: 'Phụ kiện, figure, tượng nhỏ', color: '#C79BFF', ink: '#2a0c4d', words: ['cosplay', 'mo hinh', 'figure', 'miniature', 'tuong'] },
  { slug: 'qua-tang', name: 'Quà tặng', line: 'Đèn, móc khoá, kỷ niệm', color: '#FF6F91', ink: '#fff', words: ['qua tang', 'qua', 'sinh nhat', 'ky niem', 'den ngu', 'moc khoa'] },
]

const norm = (s = '') =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

export const inInterest = (p, it) => {
  const tags = (p.tags || []).map(norm)
  if (tags.includes(it.slug)) return true
  const hay = ' ' + [p.name, ...(p.tags || [])].map(norm).join(' ') + ' '
  return it.words.some((w) => hay.includes(' ' + w) || tags.includes(w))
}

export const interestOf = (slug) => INTERESTS.find((i) => i.slug === slug)
