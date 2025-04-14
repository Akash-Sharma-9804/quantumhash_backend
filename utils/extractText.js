


// const { Mistral } = require("@mistralai/mistralai");
// const mammoth = require("mammoth");
// const xlsx = require("xlsx");

// const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// const extractText = async (buffer, mimeType, ftpUrl) => {
//   try {
//     // ✅ OCR for PDFs and images using public URL
//     if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
//       const documentUrl = `https://quantumhash.me${ftpUrl}`;
//       console.log("🔗 Document URL:", documentUrl);

//       try {
//         const response = await mistral.ocr.process({
//           model: "mistral-ocr-latest",
//           document: {
//             type: "document_url",
//             documentUrl: documentUrl,
//           },
//           includeImageBase64: false,
//         });

//         console.log("📥 Mistral OCR full response:", response);
//         console.log("📥 Full OCR response:", JSON.stringify(response, null, 2)); 

//         // Check if the OCR response has markdown
//         if (response?.pages && response.pages.length > 0) {
//           const page = response.pages[0];  // Assuming the first page has the relevant content
//           const markdownText = page?.markdown?.trim();

//           if (markdownText && markdownText.length > 0) {
//             // Return the markdown text if it exists
//             return markdownText;
//           }
//         }

//         return "[No text extracted or no markdown available]";
//       } catch (ocrError) {
//         console.error("❌ Mistral OCR error:", ocrError.message);
//         return "[Error with OCR extraction]";
//       }
//     }

//     // ✅ Handle TXT files
//     if (mimeType === "text/plain") {
//       return buffer.toString("utf-8").trim();
//     }

//     // ✅ Handle DOCX files
//     if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
//       const result = await mammoth.extractRawText({ buffer });
//       return result.value.trim();
//     }

//     // ✅ Handle Excel XLSX
//     if (
//       mimeType.includes("spreadsheet") ||
//       mimeType.includes("excel") ||
//       mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//     ) {
//       const workbook = xlsx.read(buffer, { type: "buffer" });
//       let output = "";
//       workbook.SheetNames.forEach((sheetName) => {
//         const sheet = workbook.Sheets[sheetName];
//         const text = xlsx.utils.sheet_to_txt(sheet);
//         output += `\n--- Sheet: ${sheetName} ---\n${text}`;
//       });
//       return output.trim();
//     }

//     return "[Unsupported file type]";
//   } catch (err) {
//     console.error("❌ extractText error:", err.message);
//     return "[Error extracting text]";
//   }
// };

// module.exports = extractText;




const { Mistral } = require("@mistralai/mistralai");
const mammoth = require("mammoth");
const xlsx = require("xlsx");

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

const extractText = async (buffer, mimeType, ftpUrl) => {
  try {
    // ✅ OCR for PDFs and images using public URL
    if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
      const documentUrl = `https://quantumhash.me${ftpUrl}`;
      console.log("🔗 Document URL:", documentUrl);

      try {
        const response = await mistral.ocr.process({
          model: "mistral-ocr-latest",
          document: {
            type: "document_url",
            documentUrl: documentUrl,
          },
          includeImageBase64: false,
        });

        console.log("📥 Full OCR response:", JSON.stringify(response, null, 2));

        // 🔁 Loop through all pages and merge markdown text
        if (response?.pages && response.pages.length > 0) {
          let fullText = "";
          response.pages.forEach((page, index) => {
            const markdown = page?.markdown?.trim();
            if (markdown && markdown.length > 0) {
              fullText += `\n\n--- Page ${index + 1} ---\n${markdown}`;
            }
          });

          return fullText.length > 0 ? fullText.trim() : "[No text extracted from OCR]";
        }

        return "[No pages or markdown found in OCR result]";
      } catch (ocrError) {
        console.error("❌ Mistral OCR error:", ocrError.message);
        return "[Error with OCR extraction]";
      }
    }

    // ✅ Handle plain text files (.txt)
    if (mimeType === "text/plain") {
      return buffer.toString("utf-8").trim();
    }

    // ✅ Handle DOCX files (.docx)
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    }

    // ✅ Handle Excel XLSX files
    if (
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel") ||
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      let output = "";

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const text = xlsx.utils.sheet_to_txt(sheet);
        output += `\n--- Sheet: ${sheetName} ---\n${text}`;
      });

      return output.trim();
    }

    // ❌ Unsupported file type
    return "[Unsupported file type]";
  } catch (err) {
    console.error("❌ extractText error:", err.message);
    return "[Error extracting text]";
  }
};

module.exports = extractText;
