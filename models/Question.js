const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  exam_id: { type: String, required: true },
  question_text: { type: String, required: true },
  option_a: { type: String, required: true },
  option_b: { type: String, required: true },
  option_c: { type: String, required: true },
  option_d: { type: String, required: true },
  correct_option: { type: String, required: true, uppercase: true, trim: true } // A/B/C/D
});

module.exports = mongoose.model('Question', questionSchema);
