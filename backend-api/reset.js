const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { pc } = require('./utils/pinecone.js'); // Import your Pinecone client

dotenv.config();

const resetDatabases = async () => {
    try {
        console.log("⚠️  STARTING DATABASE RESET...");

        // 1. WIPE MONGODB
        console.log("🗑️  Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/airgapped-resume-db");
        
        try {
            await mongoose.connection.collection('resumes').drop();
            console.log("✅ MongoDB 'resumes' collection dropped.");
        } catch (error) {
            if (error.code === 26) {
                console.log("ℹ️  MongoDB collection was already empty.");
            } else {
                console.error("❌ MongoDB Error:", error.message);
            }
        }

        // 2. WIPE PINECONE
        console.log("🌲 Connecting to Pinecone...");
        const indexName = process.env.PINECONE_INDEX || 'airgapped-resumes';
        const index = pc.index(indexName);

        try {
            await index.deleteAll();
            console.log(`✅ Pinecone Index '${indexName}' wiped successfully.`);
        } catch (error) {
            console.error("❌ Pinecone Error:", error.message);
        }

        console.log("\n✨ SYSTEM IS CLEAN. YOU CAN NOW UPLOAD FRESH DATA.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Critical Failure:", error);
        process.exit(1);
    }
};

resetDatabases();