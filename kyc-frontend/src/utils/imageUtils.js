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

export function enhanceImageForVerification(base64, options = {}) {
  const {
    minDimension = 960,
    brightness = 1.02,
    contrast = 1.08,
    saturate = 1.02,
    quality = 0.92
  } = options

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.max(1, minDimension / Math.min(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)

      const context = canvas.getContext('2d')
      if (!context) {
        resolve(base64)
        return
      }

      context.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`
      context.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1])
    }

    img.onerror = () => resolve(base64)
    img.src = `data:image/jpeg;base64,${base64}`
  })
}

export function analyseImageQuality(base64, options = {}) {
  const { maxDimension = 320 } = options

  return new Promise((resolve) => {
    const img = new Image()

    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))

      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        resolve({ brightness: 50, contrast: 50, sharpness: 50, qualityScore: 50 })
        return
      }

      context.drawImage(img, 0, 0, canvas.width, canvas.height)
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
      const luminance = new Float32Array(width * height)

      let sum = 0
      for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
        const value = (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114)
        luminance[pixel] = value
        sum += value
      }

      const mean = sum / luminance.length
      let variance = 0
      let sharpnessAccumulator = 0
      let samples = 0

      for (let y = 1; y < height; y += 1) {
        for (let x = 1; x < width; x += 1) {
          const idx = (y * width) + x
          const value = luminance[idx]
          variance += (value - mean) ** 2
          sharpnessAccumulator += Math.abs(value - luminance[idx - 1]) + Math.abs(value - luminance[idx - width])
          samples += 1
        }
      }

      const brightness = Math.max(0, Math.min(100, Math.round((mean / 255) * 100)))
      const contrast = Math.max(0, Math.min(100, Math.round((Math.sqrt(variance / Math.max(samples, 1)) / 64) * 100)))
      const sharpness = Math.max(0, Math.min(100, Math.round((sharpnessAccumulator / Math.max(samples, 1)) * 1.6)))

      const exposureScore = Math.max(0, 100 - (Math.abs(brightness - 58) * 1.8))
      const qualityScore = Math.round(
        (sharpness * 0.5) +
        (contrast * 0.25) +
        (exposureScore * 0.25)
      )

      resolve({
        brightness,
        contrast,
        sharpness,
        qualityScore: Math.max(0, Math.min(100, qualityScore))
      })
    }

    img.onerror = () => resolve({ brightness: 50, contrast: 50, sharpness: 50, qualityScore: 50 })
    img.src = `data:image/jpeg;base64,${base64}`
  })
}

export async function selectBestVerificationFrames(frames = []) {
  const orderedSteps = ['center', 'left', 'right', 'up', 'blink', 'smile']
  const poseBonuses = {
    center: 18,
    smile: 6,
    left: -2,
    right: -2,
    up: -8,
    blink: -20
  }

  const scoredFrames = await Promise.all(
    frames.map(async (frame, index) => {
      const metrics = await analyseImageQuality(frame)
      const step = orderedSteps[index] || `frame_${index + 1}`
      const compositeScore = metrics.qualityScore + (poseBonuses[step] || 0)

      return {
        step,
        frame,
        ...metrics,
        compositeScore
      }
    })
  )

  if (scoredFrames.length === 0) {
    return {
      primaryFrame: '',
      primaryFrameStep: '',
      primaryFrameQualityScore: 0,
      supportFrames: [],
      supportFrameDetails: [],
      frameQualityScores: []
    }
  }

  const centerFrame = scoredFrames.find(frame => frame.step === 'center')
  const nonBlinkFrames = scoredFrames.filter(frame => frame.step !== 'blink')
  const sortedFrames = [...nonBlinkFrames].sort((left, right) => right.compositeScore - left.compositeScore)

  let primary = sortedFrames[0]
  if (centerFrame && centerFrame.qualityScore >= 52 && primary && (primary.compositeScore - centerFrame.compositeScore) <= 12) {
    primary = centerFrame
  }

  const supportFrames = sortedFrames
    .filter(frame => frame.frame !== primary.frame)
    .slice(0, 2)
  const supportFrameDetails = sortedFrames
    .filter(frame => frame.frame !== primary.frame)
    .slice(0, 2)
    .map(({ step, frame, brightness, contrast, sharpness, qualityScore, compositeScore }) => ({
      step,
      frame,
      brightness,
      contrast,
      sharpness,
      qualityScore,
      compositeScore
    }))

  return {
    primaryFrame: primary.frame,
    primaryFrameStep: primary.step,
    primaryFrameQualityScore: primary.qualityScore,
    supportFrames: supportFrameDetails.map(frame => frame.frame),
    supportFrameDetails,
    frameQualityScores: scoredFrames.map(({ step, brightness, contrast, sharpness, qualityScore }) => ({
      step,
      brightness,
      contrast,
      sharpness,
      qualityScore
    }))
  }
}
