const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const poppler = require('pdf-poppler')

async function convertPDFToImage(pdfBase64) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kyc-pdf-'))
  const pdfPath = path.join(tempDir, 'input.pdf')
  const outputPrefix = 'page'
  const outputPath = path.join(tempDir, `${outputPrefix}-1.jpg`)

  try {
    await fs.writeFile(pdfPath, Buffer.from(pdfBase64, 'base64'))

    await poppler.convert(pdfPath, {
      format: 'jpeg',
      out_dir: tempDir,
      out_prefix: outputPrefix,
      page: 1,
      scale: 1600
    })

    const jpegBuffer = await fs.readFile(outputPath)
    return jpegBuffer.toString('base64')
  } catch (error) {
    throw new Error(`PDF conversion failed: ${error.message}`)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

module.exports = { convertPDFToImage }
