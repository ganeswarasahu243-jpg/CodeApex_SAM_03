const mongoose = require('mongoose');

const examAttemptSchema = new mongoose.Schema({
  exam_id: { type: String, required: true },
  student_id: { type: String, required: true },
  score: { type: Number, default: 0 },
  answers: { type: Object, default: {} },
  submitted_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExamAttempt', examAttemptSchema);
