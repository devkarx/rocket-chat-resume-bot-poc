const mongoose = require("mongoose"); 

const resumeSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true, 
        unique: true
    },
    phoneNum: {
        type: String,
        required: true,
    },
    rawText: {
        type: String, 
    },
    summary: {
        type: String,
        default: "No summary available.",
    },
    skills: {
        type: [String],
        default: [],
    },
    linkedinUrl: String,
    embeddingId: String,
    
}, {
    timestamps: true,
    strict: false 
});

const Resume = mongoose.models.Resume || mongoose.model("Resume", resumeSchema);

module.exports = Resume; 