const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  schoolname: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

teacherSchema.methods.toClient = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    schoolname: this.schoolname
  };
};

module.exports = mongoose.model('Teacher', teacherSchema);
