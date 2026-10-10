const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  subject: { type: String, required: true, trim: true },
  filename: { type: String, required: true },
  teacher_name: { type: String, required: true, trim: true },
  timestamp: { type: Date, default: Date.now }
});

assignmentSchema.methods.toClient = function() {
  return {
    id: this._id,
    subject: this.subject,
    teacher_name: this.teacher_name,
    date: this.timestamp.toISOString().split('T')[0],
    url: `http://localhost:5000/uploads/${this.filename}`
  };
};

module.exports = mongoose.model('Assignment', assignmentSchema);
