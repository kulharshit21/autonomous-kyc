// imageUtils.js — file reading and image resizing utilities

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function resizeImageIfNeeded(base64, maxSizeKB = 1024) {
  const sizeKB = (base64.length * 3 / 4) / 1024
  if (sizeKB <= maxSizeKB) return Promise.resolve(base64)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.sqrt((maxSizeKB * 1024) / (base64.length * 3 / 4))
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    img.src = `data:image/jpeg;base64,${base64}`
  })
}
