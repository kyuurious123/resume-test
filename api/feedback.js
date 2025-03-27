import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";

export const config = {
  api: {
    bodyParser: false,
  },
};

// ✅ OpenAI 인스턴스 생성 (버전 4.x 방식)
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

  try {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("파일 파싱 실패:", err);
        res.status(500).json({ error: "파일 파싱 중 오류 발생" });
        return;
      }

      try {
        const file = files.file;
        const dataBuffer = fs.readFileSync(file.filepath);
        const parsed = await pdfParse(dataBuffer);
        const resumeText = parsed.text;

        const systemPrompt = `
당신은 치과 병원에서 위생사를 채용한 경험이 많은 인사담당자입니다. 
다음 이력서를 읽고, 위생사 입장에서 더 좋게 개선할 수 있는 방향을 구체적으로 알려주세요. 
친절한 문장으로, 포인트만 3가지로 요약해주세요.
`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: resumeText },
          ],
        });

        const feedback = completion.choices[0].message.content;
        res.status(200).json({ result: feedback });
      } catch (innerErr) {
        console.error("GPT 또는 파일 처리 실패:", innerErr);
        res.status(500).json({ error: "GPT 처리 실패" });
      }
    });
  } catch (outerErr) {
    console.error("전체 오류:", outerErr);
    res.status(500).json({ error: "서버 내부 오류" });
  }
}
