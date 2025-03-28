import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const form = formidable({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.error("파일 업로드 오류:", err);
        res.status(500).json({ error: "파일 업로드 실패" });
        return;
      }

      const uploadedFile = files.file;
      const filePath = uploadedFile?.filepath || uploadedFile[0]?.filepath;

      if (!filePath || !fs.existsSync(filePath)) {
        res.status(400).json({ error: "PDF 파일을 찾을 수 없습니다." });
        return;
      }

      const data = new Uint8Array(fs.readFileSync(filePath));
      const pdf = await pdfjsLib.getDocument({ data }).promise;

      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(" ");
        text += pageText + "\n";
      }

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
      });

      const feedback = completion.choices[0].message.content;
      res.status(200).json({ result: feedback });
    } catch (e) {
      console.error("GPT 처리 실패:", e);
      res.status(500).json({ error: "서버 내부 오류" });
    }
  });
}
