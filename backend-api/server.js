const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const mongoose = require('mongoose');
const resumeRoutes = require("./routes/resumeRoutes.js");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());

// --- FIX: INCREASE PAYLOAD LIMITS ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// ------------------------------------

app.use('/api/resume', resumeRoutes);

app.get('/', (req, res) => {
    res.send('Air-Gapped Backend is Running');
});

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/airgapped-resume-db")
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

app.listen(PORT, () => {
    console.log(`🚀 MERN Backend running on port ${PORT}`);
});