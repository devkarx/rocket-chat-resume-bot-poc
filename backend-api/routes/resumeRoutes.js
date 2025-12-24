const {ingestResume, searchResume} = require("../controllers/resumeController")

const express = require('express')
const router = express.Router()

router.post('/ingest', ingestResume)
router.post('/search', searchResume);


module.exports = router