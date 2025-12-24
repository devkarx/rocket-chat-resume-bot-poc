const express = require('express');
const bodyParser = require('body-parser');

// 1. Load the library
let pdfLib = require('pdf-parse');

// --- 🕵️ LIBRARY INSPECTOR (DEBUGGING) ---
console.log("------------------------------------------------");
console.log("🔍 INSPECTING PDF LIBRARY...");
console.log("Type of export:", typeof pdfLib);

// If it's an object, print its keys so we know what we installed
if (typeof pdfLib === 'object') {
    console.log("Exported Keys:", Object.keys(pdfLib));
}

// 2. INTELLIGENT SELECTION
// We check if the function is the export itself, or hidden inside .default
let pdfFunction;

if (typeof pdfLib === 'function') {
    pdfFunction = pdfLib;
    console.log("✅ Library is a Function (Correct).");
} else if (pdfLib.default && typeof pdfLib.default === 'function') {
    pdfFunction = pdfLib.default;
    console.log("✅ Library found in .default (CommonJS Fix).");
} else {
    console.log("❌ Library is NOT a function. It is likely corrupted or the wrong package.");
    // We don't crash yet, we let the request fail gracefully
}
console.log("------------------------------------------------");

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

app.post('/parse', async (req, res) => {
    try {
        if (!pdfFunction) {
            return res.status(500).json({ error: "Server Configuration Error: PDF Library could not be loaded." });
        }

        console.log("📥 Receiving PDF...");
        if (!req.body.file) return res.status(400).json({ error: "No file sent" });
        
        const buffer = Buffer.from(req.body.file, 'base64');
        
        // 3. EXECUTE
        const data = await pdfFunction(buffer);
        
        const text = data.text.replace(/\n\s*\n/g, '\n').trim();
        console.log(`✅ Extracted ${text.length} chars.`);
        
        res.json({ text: text });

    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(5000, () => {
    console.log("🚀 Debug Reader running on port 5000");
});