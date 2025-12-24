require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

// Initialize Pinecone
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

const storeVector = async (id, vector, metadata) => {
    console.log(`\n--- 🔵 STARTING PINECONE STORE ---`);
    console.log(`🔹 ID: ${id}`);
    console.log(`🔹 Vector Length: ${vector ? vector.length : 'UNDEFINED'}`);
    
    // Check for null vector
    if (!vector) {
        console.error("❌ ERROR: Vector is null or undefined!");
        return;
    }

    try {
        const indexName = process.env.PINECONE_INDEX || 'airgapped-resumes';
        console.log(`🔹 Target Index: ${indexName}`);
        
        const index = pc.index(indexName);

        // Check Metadata Size (Pinecone has a 40KB limit!)
        const metadataSize = JSON.stringify(metadata).length;
        console.log(`🔹 Metadata Size: ${metadataSize} bytes`);

        if (metadataSize > 40000) {
            console.warn("⚠️ WARNING: Metadata might be too large! Truncating text...");
            metadata.rawText = metadata.rawText.substring(0, 10000); // Cut text to be safe
        }

        console.log("🔹 Sending Upsert Request...");
        
        await index.upsert([{
            id: id,
            values: vector,
            metadata: metadata
        }]);

        console.log(`✅ SUCCESS: Pinecone Upsert Complete for ID: ${id}`);
        console.log(`--- 🏁 END PINECONE STORE ---\n`);

    } catch (error) {
        console.error("\n❌❌❌ PINECONE CRITICAL ERROR ❌❌❌");
        console.error(error); 
        console.error("----------------------------------------\n");
    }
};

module.exports = { storeVector, pc };