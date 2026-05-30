import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGemini, GEMINI_MODEL } from '@/lib/ai/gemini'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let imageBase64: string | undefined
  let mimeType: string | undefined

  const ct = req.headers.get('content-type') ?? ''
  if (ct.startsWith('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'Imagem ausente' }, { status: 400 })
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: `Imagem maior que ${MAX_IMAGE_BYTES / 1024 / 1024}MB` }, { status: 413 })
    }
    const declaredType = (file.type || '').toLowerCase()
    if (!ALLOWED_MIMES.has(declaredType)) {
      return NextResponse.json({ error: `Tipo não permitido. Use JPG, PNG ou WebP.` }, { status: 415 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    imageBase64 = buf.toString('base64')
    mimeType = declaredType
  } else {
    const body = await req.json()
    if (typeof body.imageBase64 !== 'string') {
      return NextResponse.json({ error: 'imageBase64 inválido' }, { status: 400 })
    }
    // Aproximação: base64 cresce ~33%; limite proporcional ao bruto
    if (body.imageBase64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3)) {
      return NextResponse.json({ error: `Imagem maior que ${MAX_IMAGE_BYTES / 1024 / 1024}MB` }, { status: 413 })
    }
    const declaredType = String(body.mimeType ?? 'image/jpeg').toLowerCase()
    if (!ALLOWED_MIMES.has(declaredType)) {
      return NextResponse.json({ error: `Tipo não permitido. Use JPG, PNG ou WebP.` }, { status: 415 })
    }
    imageBase64 = body.imageBase64
    mimeType = declaredType
  }

  if (!imageBase64) return NextResponse.json({ error: 'Imagem ausente' }, { status: 400 })

  try {
    const genai = getGemini()
    const model = genai.getGenerativeModel({ model: GEMINI_MODEL })

    const prompt = `Você é um extrator de dados de comprovantes financeiros (cupom fiscal, Pix, NFCe, recibo, fatura).
Analise a imagem e retorne APENAS JSON válido, sem markdown, sem comentários, neste formato exato:
{
  "amount": <número decimal, ex: 124.50>,
  "date": "YYYY-MM-DD",
  "description": "<estabelecimento ou destinatário, máximo 60 chars>",
  "suggested_category": "<uma de: alimentacao, transporte, moradia, saude, educacao, lazer, vestuario, assinaturas, pets, investimentos, compras_online, outros>",
  "confidence": <0 a 1>
}
Se não conseguir identificar algum campo, use null. Se a data não estiver clara, use o ano atual.`

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: mimeType!, data: imageBase64 } },
    ])

    const text = result.response.text().trim()
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')
    let data
    try {
      data = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Resposta inválida da IA', raw: text.slice(0, 500) }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro IA' }, { status: 500 })
  }
}
