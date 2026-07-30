import { useState, useRef, useCallback } from 'react'
import { useDocumentHead } from '../../hooks/useDocumentHead'
import styles from './CounterGenerator.module.css'

export default function CounterGenerator() {
  const breadcrumbs = [
    { name: '首页', url: '/' },
    { name: '遇敌计数器主题生成器', url: '/counter-generator' }
  ];

  useDocumentHead({
    title: 'PokeMMO 遇敌计数器主题生成器',
    description: '用于生成 PokeMMO 自定义遇敌计数器主题的工具。',
    canonicalPath: '/counter-generator/',
    breadcrumbs
  })

  const [status, setStatus] = useState('')
  const [generateEnabled, setGenerateEnabled] = useState(false)
  const loadedFileRef = useRef(null)

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0]
    if (!file) return

    loadedFileRef.current = file
    setStatus('文件已加载，点击“生成 XML 与压缩包”开始处理。')
    setGenerateEnabled(true)
  }, [])

  const resizeToBlob = useCallback((fileOrBlob, width, height) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(fileOrBlob)

      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        ctx.clearRect(0, 0, width, height)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url)
          resolve(blob)
        }, 'image/png')
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('图片加载失败'))
      }

      img.src = url
    })
  }, [])

  const handleGenerate = useCallback(async () => {
    const file = loadedFileRef.current
    if (!file) {
      setStatus('请先上传 GIF 或 PNG。')
      return
    }

    const w = Number(document.getElementById('gifWidth').value) || 300
    const h = Number(document.getElementById('gifHeight').value) || 250
    const userDuration = Number(document.getElementById('frameDuration').value) || 100

    setStatus('正在处理帧…')

    try {
      const { GifReader } = await import('omggif')
      const JSZip = (await import('jszip')).default

      let frames = []

      if (file.type === 'image/gif') {
        const buffer = new Uint8Array(await file.arrayBuffer())
        const reader = new GifReader(buffer)

        const width = reader.width
        const height = reader.height

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        let fullFrame = new Uint8ClampedArray(width * height * 4)
        let prevFrame = null

        for (let i = 0; i < reader.numFrames(); i++) {
          const info = reader.frameInfo(i)

          if (info.disposal === 2) {
            fullFrame.fill(0)
            ctx.clearRect(0, 0, width, height)
          } else if (info.disposal === 3 && prevFrame) {
            fullFrame.set(prevFrame)
          }

          prevFrame = new Uint8ClampedArray(fullFrame)

          reader.decodeAndBlitFrameRGBA(i, fullFrame)

          const imageData = new ImageData(fullFrame, width, height)
          ctx.putImageData(imageData, 0, 0)

          const resizedCanvas = document.createElement('canvas')
          resizedCanvas.width = w
          resizedCanvas.height = h
          const rctx = resizedCanvas.getContext('2d')

          rctx.clearRect(0, 0, w, h)
          rctx.imageSmoothingEnabled = true
          rctx.imageSmoothingQuality = 'high'
          rctx.drawImage(canvas, 0, 0, width, height, 0, 0, w, h)

          const blob = await new Promise(res => resizedCanvas.toBlob(res, 'image/png'))

          frames.push({
            name: `frame-${String(i + 1).padStart(5, '0')}.png`,
            blob,
            duration: userDuration
          })
        }
      } else if (file.type.startsWith('image/')) {
        const blob = await resizeToBlob(file, w, h)
        frames = [{ name: 'frame-00001.png', blob, duration: userDuration }]
      } else {
        throw new Error('不支持的文件类型，请上传 GIF 或 PNG。')
      }

      // ✅ FIX: smooth looping
      if (frames.length > 1) {
        const first = frames[0]
        frames.push({
          name: `frame-${String(frames.length + 1).padStart(5, '0')}.png`,
          blob: first.blob,
          duration: first.duration
        })
      }

      setStatus(`已提取 ${frames.length} 帧，正在加载 XML 模板…`)

      const fetchXml = (path) => fetch(path).then(r => {
        if (!r.ok) throw new Error(`加载 ${path} 失败：${r.status}`)
        return r.text()
      })

      const [counterThemeBottom, infoXML] = await Promise.all([
        fetchXml('/xml/counterThemeBottom.xml'),
        fetchXml('/xml/info.xml'),
      ])

      const zip = new JSZip()
      const base = 'data'
      const animFolder = zip.folder(`${base}/anim`)

      frames.forEach(frame => animFolder.file(frame.name, frame.blob))

      if (frames.length > 0) {
        zip.file('icon.png', frames[0].blob)
      }

      const minimisedFile = document.getElementById('minimisedFile').files[0]
      const miniW = Number(document.getElementById('miniWidth').value) || 100
      const miniH = Number(document.getElementById('miniHeight').value) || 100

      let minimisedBlob = null
      if (minimisedFile) {
        minimisedBlob = await resizeToBlob(minimisedFile, miniW, miniH)
      } else if (frames.length > 0) {
        minimisedBlob = await resizeToBlob(frames[0].blob, miniW, miniH)
      }

      if (minimisedBlob) {
        const unexpandedFolder = zip.folder(`${base}/unexpanded`)
        unexpandedFolder.file('minimised.png', minimisedBlob)
      }

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<themes>\n\n`

      frames.forEach((frame, index) => {
        const frameNumber = String(index + 1).padStart(5, '0')
        xml += `<images file="anim/${frame.name}" filter="nearest">\n`
        xml += `    <area name="bg-${frameNumber}" xywh="*"/>\n`
        xml += `</images>\n\n`
      })

      xml += `    <images>\n        <animation name="encounter_counter_anim" timeSource="enabled">\n\n`

      frames.forEach((frame, index) => {
        const frameNumber = String(index + 1).padStart(5, '0')
        xml += `<frame ref="bg-${frameNumber}" duration="${frame.duration}"/>\n`
      })

      xml += `        </animation>\n    </images>\n\n`
      xml += counterThemeBottom

      zip.file(`${base}/custom-counter.xml`, xml)

      const zipNameValue = document.getElementById('zipName').value.trim() || 'custom-counter'
      const themeName = zipNameValue.replace(/\.zip$/i, '')
      const infoXMLReplaced = infoXML.replace(/\$\{themeName\}/g, themeName)
      zip.file('info.xml', infoXMLReplaced)

      const outputZipName = zipNameValue.endsWith('.zip') ? zipNameValue : zipNameValue + '.zip'
      const content = await zip.generateAsync({ type: 'blob' })

      const a = document.createElement('a')
      a.href = URL.createObjectURL(content)
      a.download = outputZipName
      a.click()

      setStatus('压缩包已成功生成！')
    } catch (err) {
      console.error(err)
      setStatus('文件处理失败：' + err.message)
    }
  }, [resizeToBlob])

  return (
    <div className={styles.page}>
      <h2>PokeMMO 遇敌计数器主题生成器</h2>

      <div className={styles.formGroup}>
        <label htmlFor="zipFileInput">上传 GIF 或图片</label>
        <input
          id="zipFileInput"
          type="file"
          accept="image/gif,image/png,image/webp,image/jpeg,image/jpg"
          onChange={handleFileChange}
        />
      </div>

      <div className={`${styles.formGroup} ${styles.sizeGroup}`}>
        <label>GIF / 图片尺寸</label>
        <div className={styles.sizeInputs}>
          <div>
            <span>宽度</span>
            <input type="number" id="gifWidth" defaultValue={300} min={1} />
          </div>
          <div>
            <span>高度</span>
            <input type="number" id="gifHeight" defaultValue={250} min={1} />
          </div>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="zipName">主题名称：</label>
        <input type="text" id="zipName" placeholder="自定义主题.zip" defaultValue="自定义主题" />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="minimisedFile">最小化图片（可选）：</label>
        <input type="file" id="minimisedFile" accept="image/*" />
      </div>

      <div className={`${styles.formGroup} ${styles.sizeGroup}`}>
        <label>最小化图片尺寸</label>
        <div className={styles.sizeInputs}>
          <div>
            <span>宽度</span>
            <input type="number" id="miniWidth" defaultValue={200} min={1} />
          </div>
          <div>
            <span>高度</span>
            <input type="number" id="miniHeight" defaultValue={50} min={1} />
          </div>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="frameDuration">帧时长（毫秒）</label>
        <input type="number" id="frameDuration" defaultValue={100} min={1} step={1} />
      </div>

      <div className={styles.status}>{status}</div>

      <button
        className={styles.generateBtn}
        disabled={!generateEnabled}
        onClick={handleGenerate}
      >
        生成 XML 与压缩包
      </button>
    </div>
  )
}
