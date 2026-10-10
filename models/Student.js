const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  age: { type: Number, required: true },
  schoolname: { type: String, required: true, trim: true },
  classofstudy: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  score: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

studentSchema.methods.toClient = function() {
  return {
    id: this._id,
    name: this.name,
    age: this.age,
    schoolname: this.schoolname,
    classofstudy: this.classofstudy,
    score: this.score,
    xp: this.xp
  };
};

module.exports = mongoose.model('Student', studentSchema);
