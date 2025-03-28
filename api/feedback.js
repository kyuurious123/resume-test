import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';

// ESM 환경에서 CommonJS 모듈 사용을 위한 require 생성
const require = createRequire(import.meta.url);
const PDFParser = require('pdf2json');

export const config = {
  api: {
    bodyParser: false,
  },
};

// OpenAI API 키 설정
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
    // CORS 설정 - 모든 도메인 허용 (프레이머 포함)
    res.setHeader("Access-Control-Allow-Origin", "https://project-fizmmotayn3fhbctn1li.framercanvas.com");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  
    // OPTIONS 요청 처리 (preflight 요청)
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

  // POST 요청만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    console.log("API 호출 시작");
    
    // formidable 설정
    const form = formidable({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB 제한
    });

    // 파일 업로드 처리
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error("파일 파싱 오류:", err);
          return reject(err);
        }
        resolve([fields, files]);
      });
    });

    console.log("파일 업로드 완료");
    
    // 파일 객체 확인
    const fileObj = files.file;
    if (!fileObj) {
      return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
    }
    
    // 파일 경로 가져오기 (formidable v4 호환)
    let filePath;
    if (Array.isArray(fileObj)) {
      filePath = fileObj[0].filepath;
    } else {
      filePath = fileObj.filepath;
    }
    
    console.log("파일 경로:", filePath);

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: "업로드된 파일을 찾을 수 없습니다." });
    }
    
    console.log("파일 존재 확인 완료");

    // PDF 파싱 시작
    console.log("PDF 파싱 시작");
    const pdfText = await parsePDF(filePath);
    console.log("PDF 파싱 완료, 텍스트 길이:", pdfText.length);

    if (!pdfText || pdfText.trim().length === 0) {
      return res.status(400).json({ error: "PDF에서 텍스트를 추출할 수 없습니다." });
    }

    // OpenAI API 호출
    console.log("OpenAI API 호출 시작");
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
          content: pdfText,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    console.log("OpenAI API 호출 완료");

    const feedback = completion.choices[0].message.content;
    return res.status(200).json({ result: feedback });
  } catch (error) {
    console.error("처리 오류:", error);
    return res.status(500).json({
      error: "서버 내부 오류",
      message: error.message,
      details: error.toString(),
    });
  }
}

// PDF 파싱 함수
async function parsePDF(filePath) {
  return new Promise((resolve, reject) => {
    try {
      // 파서 인스턴스 생성
      const pdfParser = new PDFParser();
      
      // 오류 이벤트 핸들러
      pdfParser.on("pdfParser_dataError", (errData) => {
        console.error("PDF 파싱 오류:", errData);
        reject(new Error(`PDF 파싱 오류: ${errData}`));
      });
      
      // 완료 이벤트 핸들러
      pdfParser.on("pdfParser_dataReady", () => {
        try {
          // 텍스트 추출
          const text = pdfParser.getRawTextContent();
          resolve(text);
        } catch (err) {
          console.error("텍스트 추출 오류:", err);
          reject(new Error(`텍스트 추출 오류: ${err.message}`));
        }
      });
      
      // PDF 로드
      pdfParser.loadPDF(filePath);
    } catch (err) {
      console.error("PDF 파서 초기화 오류:", err);
      reject(new Error(`PDF 파서 초기화 오류: ${err.message}`));
    }
  });
}