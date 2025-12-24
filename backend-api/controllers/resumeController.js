const Resume = require('../models/resume.js');
const { generateEmbedding } = require('../utils/embeddings.js');
const { storeVector, pc } = require('../utils/pinecone.js');
const pdf = require('pdf-parse'); 

const ingestResume = async (req, res) => {
    try {
        console.log("\n📥 --- INGESTING DATA ---");
        let { text, candidateName, fileBase64, filename } = req.body;

        // 1. Parse PDF if Base64 is provided
        if (!text && fileBase64) {
            console.log("📄 Parsing PDF (v1.1.1)...");
            const dataBuffer = Buffer.from(fileBase64, 'base64');
            const data = await pdf(dataBuffer);
            
            // CLEANUP: Replace newlines with spaces to avoid weird chopping
            text = data.text.replace(/\n/g, " "); 
            console.log(`✅ Extracted ${text.length} chars.`);
        }

        if (!text) return res.status(400).json({ error: "No text extracted." });

        // 2. Extract Metadata
        const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
        const extractedEmail = emailMatch ? emailMatch[0] : `unknown_${Date.now()}@resume.com`;
        
        const phoneMatch = text.match(/\b\d{10,}\b/);
        const extractedPhone = phoneMatch ? phoneMatch[0] : "0000000000";

        // 3. Generate Embeddings
        const vectors = await generateEmbedding(text);
        if (!vectors) return res.status(500).json({ error: "Embedding failed" });

        // 4. Save to MongoDB
        let resumeDoc = await Resume.findOne({ email: extractedEmail });
        let isUpdate = false;

        if (resumeDoc) {
            console.log("🔄 Updating Resume...");
            resumeDoc.rawText = text;
            resumeDoc.fullName = candidateName;
            await resumeDoc.save();
            isUpdate = true;
        } else {
            console.log("🆕 Creating Resume...");
            resumeDoc = await Resume.create({
                fullName: candidateName,
                email: extractedEmail,
                phoneNum: extractedPhone,
                rawText: text,
                skills: [],
                summary: "Pending AI Analysis..."
            });
        }

        // 5. Save to Pinecone
        await storeVector(
            resumeDoc._id.toString(),
            vectors, 
            {
                name: candidateName,
                email: extractedEmail,
                rawText: text, // Saving FULL text
                filename: filename
            }
        );
        
        res.status(isUpdate ? 200 : 201).json({ 
            success: true, 
            id: resumeDoc._id 
        });

    } catch (error) {
        console.error("❌ Ingest Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const searchResume = async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: "No query" });

        const queryVector = await generateEmbedding(query);
        const index = pc.index(process.env.PINECONE_INDEX || 'airgapped-resumes');

        const searchResult = await index.query({
            vector: queryVector,
            topK: 3, 
            includeMetadata: true 
        });

        const matches = searchResult.matches.map(match => ({
            id: match.id,
            name: match.metadata.name,
            score: (match.score * 100).toFixed(2), 
            email: match.metadata.email,
            // CRITICAL: Send full text, fallback to snippet only if empty
            text: match.metadata.rawText || "",
            snippet: match.metadata.rawText ? match.metadata.rawText.substring(0, 200) + "..." : ""
        }));

        res.json({ success: true, matches });

    } catch (error) {
        console.error("❌ Search Error:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { ingestResume, searchResume };