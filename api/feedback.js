import formidable from "formidable"
import fs from "fs"
import OpenAI from "openai"
import PDFParser from "pdf2json"

export const config = {
  api: {
    bodyParser: false,
  },
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req, res) {
  // ✅ CORS 헤더
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  // ✅ OPTIONS 요청 대응 (프리플라이트 요청)
  if (req.method === "OPTIONS") {
    res.status(200).end()
    return
  }

  // ✅ POST만 허용
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" })
    return
  }

  const form = formidable({ multiples: false, keepExtensions: true })

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("파일 파싱 에러:", err)
      res.status(500).json({ error: "파일 파싱 실패" })
      return
    }

    const uploadedFile = files.file
    const filePath = Array.isArray(uploadedFile)
      ? uploadedFile[0]?.filepath
      : uploadedFile?.filepath

    if (!filePath || !fs.existsSync(filePath)) {
      res.status(400).json({ error: "PDF 파일이 없습니다." })
      return
    }

    try {
      // ✅ pdf2json을 Promise로 감싸 비동기 흐름 제어
      const text = await new Promise((resolve, reject) => {
        const parser = new PDFParser()

        parser.on("pdfParser_dataError", err => reject(err.parserError))
        parser.on("pdfParser_dataReady", pdfData => {
          resolve(parser.getRawTextContent())
        })

        parser.loadPDF(filePath)
      })

      // ✅ GPT API 요청
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "당신은 치과 병원에서 위생사를 채용한 경험이 많은 인사담당자입니다. 다음 이력서를 읽고, 위생사 입장에서 더 좋게 개선할 수 있는 방향을 구체적으로 알려주세요. 친절한 문장으로, 포인트만 3가지로 요약해주세요.",
          },
          {
            role: "user",
            content: text,
          },
        ],
      })

      const feedback = completion.choices[0].message.content
      res.status(200).json({ result: feedback })
    } catch (e) {
      console.error("GPT 처리 실패:", e)
      res.status(500).json({ error: "GPT 처리 실패" })
    }
  })
}
