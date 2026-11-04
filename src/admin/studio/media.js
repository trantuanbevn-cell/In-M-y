import { supabase, STUDIO_BUCKET } from '../../supabase.js'

// Tải 1 file lên kho studio-media, trả về { path, url }
export async function uploadStudioFile(file, folder) {
  const ext = (file.name?.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(STUDIO_BUCKET).upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  return { path, url: supabase.storage.from(STUDIO_BUCKET).getPublicUrl(path).data.publicUrl }
}

export async function removeStudioFile(path) {
  if (!path) return
  await supabase.storage.from(STUDIO_BUCKET).remove([path])
}

// Tải file về máy (fetch -> blob, vì thuộc tính download không chạy với link khác tên miền)
export async function downloadUrl(url, filename) {
  const res = await fetch(url)
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || url.split('/').pop()
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
