const axios = require('axios');

async function generateEmbedding(text){
    try {
        const response = await axios.post("http://127.0.0.1:11434/api/embeddings", {
            "model": "nomic-embed-text",
            "prompt": text,
        })
        return response.data.embedding;
    } catch (error) {
        console.error("❌ Embedding Error:", error.message);
        return null;
    }
}

module.exports = { generateEmbedding };