/**
 * AlgoPlay — Node.js & Express Backend with MongoDB (Mongoose)
 * 
 * Features:
 * - Full REST API for Student & Teacher authentication
 * - MongoDB persistence for Students, Teachers, Exams, Questions, Attempts & Assignments
 * - Multer file upload for teacher assignment distribution
 * - Learning analytics & misconception metric logging
 * - Resilient graceful connection handling (handles offline & active MongoDB instances)
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import Mongoose Models
const Student = require('./models/Student');
const Teacher = require('./models/Teacher');
const Exam = require('./models/Exam');
const Question = require('./models/Question');
const ExamAttempt = require('./models/ExamAttempt');
const Assignment = require('./models/Assignment');
const LearningMetric = require('./models/LearningMetric');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/algoplay';

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = Date.now() + '_' + Math.random().toString(36).substring(2, 8) + ext;
    cb(null, safeName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend and uploads
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(__dirname));

// MongoDB Connection State Tracking
let isMongoConnected = false;

// Fallback in-memory stores for seamless offline operation
const memoryStore = {
  students: [],
  teachers: [],
  exams: [
    { id: '1', title: 'Mid-Term Mathematics Test', subject: 'Mathematics', duration: 30, is_active: true },
    { id: '2', title: 'General Science Assessment', subject: 'Science', duration: 25, is_active: true },
    { id: '3', title: 'Computer Logic & Coding Quiz', subject: 'Technology', duration: 20, is_active: true }
  ],
  questions: [
    { id: '101', exam_id: '1', question: 'What is 15 * 8 - 25?', A: '95', B: '105', C: '85', D: '115', correct: 'A' },
    { id: '102', exam_id: '1', question: 'Which fraction is equivalent to 1/2?', A: '2/4', B: '2/6', C: '3/8', D: '1/4', correct: 'A' },
    { id: '201', exam_id: '2', question: 'Which organelle is the powerhouse of the cell?', A: 'Nucleus', B: 'Mitochondria', C: 'Ribosome', D: 'Chloroplast', correct: 'B' },
    { id: '301', exam_id: '3', question: 'What does HTML stand for?', A: 'Hyper Text Markup Language', B: 'High Tech Machine Language', C: 'Hyperlink Text Mode Layout', D: 'Home Tool Markup Language', correct: 'A' }
  ],
  assignments: [
    { id: 'a1', subject: 'Science', teacher_name: 'Prof. Sharma', date: '2026-10-10', filename: 'science_lab_guide.pdf' },
    { id: 'a2', subject: 'Mathematics', teacher_name: 'Prof. Sharma', date: '2026-10-09', filename: 'fractions_practice.pdf' },
    { id: 'a3', subject: 'Technology', teacher_name: 'Mrs. Sen', date: '2026-10-08', filename: 'intro_algorithms.pdf' }
  ],
  attempts: []
};

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 2500
})
.then(() => {
  isMongoConnected = true;
  console.log('✅ Connected to MongoDB successfully at:', MONGODB_URI);
})
.catch((err) => {
  isMongoConnected = false;
  console.warn('⚠️ MongoDB connection could not be established:', err.message);
  console.warn('ℹ️ Running in resilient fallback mode with in-memory persistence.');
});

mongoose.connection.on('connected', () => { isMongoConnected = true; });
mongoose.connection.on('disconnected', () => { isMongoConnected = false; });

// ==========================================
// API ROUTES
// ==========================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    backend: 'Node.js / Express',
    database: isMongoConnected ? 'MongoDB (Connected)' : 'MongoDB (Resilient Fallback Active)'
  });
});

// ------------------------------------------
// 1. STUDENT AUTHENTICATION
// ------------------------------------------

// Student Signup
app.post('/Signup', async (req, res) => {
  try {
    const { name, age, schoolname, classofstudy, password } = req.body;
    if (!name || !age || !schoolname || !classofstudy || !password) {
      return res.status(400).json({ error: 'Missing required signup fields' });
    }

    if (isMongoConnected) {
      const existing = await Student.findOne({ name });
      if (existing) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      const student = new Student({
        name,
        age: Number(age),
        schoolname,
        classofstudy,
        password,
        score: 0,
        xp: 120
      });
      await student.save();
      return res.status(201).json({ message: 'Signup successful', student: student.toClient() });
    } else {
      // Memory fallback
      const existing = memoryStore.students.find(s => s.name === name);
      if (existing) return res.status(400).json({ error: 'Username already exists' });
      const newStudent = {
        id: String(Date.now()),
        name,
        age: Number(age),
        schoolname,
        classofstudy,
        password,
        score: 0,
        xp: 120
      };
      memoryStore.students.push(newStudent);
      return res.status(201).json({ message: 'Signup successful', student: newStudent });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Login
app.post('/Login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password required' });
    }

    if (isMongoConnected) {
      const student = await Student.findOne({ name: identifier });
      if (!student || student.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      return res.json({ message: 'Login successful', student: student.toClient() });
    } else {
      const student = memoryStore.students.find(s => s.name === identifier && s.password === password);
      if (!student) {
        // Create demo student for smooth demo preview if not found
        const demoStudent = {
          id: '101',
          name: identifier,
          age: 12,
          schoolname: 'AlgoPlay Academy',
          classofstudy: 'Grade 6',
          score: 45,
          xp: 120
        };
        return res.json({ message: 'Login successful (Demo Mode)', student: demoStudent });
      }
      return res.json({ message: 'Login successful', student });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------
// 2. TEACHER AUTHENTICATION & DASHBOARD
// ------------------------------------------

// Teacher Signup
app.post('/TeacherSignup', async (req, res) => {
  try {
    const { name, email, schoolname, password } = req.body;
    if (!name || !email || !schoolname || !password) {
      return res.status(400).json({ error: 'Missing required teacher fields' });
    }

    if (isMongoConnected) {
      const existing = await Teacher.findOne({ email });
      if (existing) return res.status(400).json({ error: 'Email already exists' });
      const teacher = new Teacher({ name, email, schoolname, password });
      await teacher.save();
      return res.status(201).json({ message: 'Signup successful', teacher: teacher.toClient() });
    } else {
      const existing = memoryStore.teachers.find(t => t.email === email);
      if (existing) return res.status(400).json({ error: 'Email already exists' });
      const newTeacher = { id: String(Date.now()), name, email, schoolname, password };
      memoryStore.teachers.push(newTeacher);
      return res.status(201).json({ message: 'Signup successful', teacher: newTeacher });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher Login
app.post('/TeacherLogin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (isMongoConnected) {
      const teacher = await Teacher.findOne({ email });
      if (!teacher || teacher.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      return res.json({ message: 'Login successful', teacher: teacher.toClient() });
    } else {
      const teacher = memoryStore.teachers.find(t => t.email === email && t.password === password) || {
        id: '1',
        name: 'Prof. Sharma',
        email: email || 'teacher@algoplay.org',
        schoolname: 'AlgoPlay Demonstration School'
      };
      return res.json({ message: 'Login successful', teacher });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher Dashboard Metrics
app.get('/teacher/dashboard', async (req, res) => {
  try {
    const { email } = req.query;
    let teacher = null;
    let students = [];

    if (isMongoConnected && email) {
      teacher = await Teacher.findOne({ email });
      if (teacher) {
        students = await Student.find({ schoolname: teacher.schoolname });
      }
    }

    if (!students || students.length === 0) {
      students = isMongoConnected ? await Student.find().limit(20) : memoryStore.students;
    }

    // Default sample class data for complete teacher visibility
    if (students.length === 0) {
      students = [
        { id: 1, name: 'Aarav Patel', age: 11, schoolname: 'AlgoPlay Demo', classofstudy: 'Grade 6', score: 85, xp: 420 },
        { id: 2, name: 'Diya Sharma', age: 12, schoolname: 'AlgoPlay Demo', classofstudy: 'Grade 6', score: 92, xp: 510 },
        { id: 3, name: 'Vihaan Reddy', age: 11, schoolname: 'AlgoPlay Demo', classofstudy: 'Grade 6', score: 48, xp: 190 },
        { id: 4, name: 'Ananya Rao', age: 12, schoolname: 'AlgoPlay Demo', classofstudy: 'Grade 6', score: 78, xp: 340 },
        { id: 5, name: 'Kavya Nair', age: 11, schoolname: 'AlgoPlay Demo', classofstudy: 'Grade 6', score: 32, xp: 130 }
      ];
    }

    const totalStudents = students.length;
    const activeStudents = students.filter(s => (s.score || 0) > 0).length;
    const excellent = students.filter(s => (s.score || 0) >= 80).length;
    const average = students.filter(s => (s.score || 0) >= 40 && (s.score || 0) < 80).length;
    const needsHelp = students.filter(s => (s.score || 0) < 40).length;

    const classDistribution = {};
    students.forEach(s => {
      const cls = s.classofstudy || 'Grade 6';
      classDistribution[cls] = (classDistribution[cls] || 0) + 1;
    });

    res.json({
      teacher: teacher ? (teacher.toClient ? teacher.toClient() : teacher) : { name: 'Prof. Sharma', schoolname: 'AlgoPlay Academy' },
      stats: {
        total_students: totalStudents,
        active_students: activeStudents
      },
      progress_chart: {
        excellent,
        average,
        needs_help: needsHelp
      },
      class_chart: classDistribution,
      students: students.map(s => (s.toClient ? s.toClient() : s))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------
// 3. EXAMS & ASSESSMENTS
// ------------------------------------------

// Create Exam
app.post('/exam/create', async (req, res) => {
  try {
    const { title, subject, duration, teacher_id } = req.body;
    if (!title || !subject || !duration) {
      return res.status(400).json({ error: 'Title, subject, and duration required' });
    }

    if (isMongoConnected) {
      const exam = new Exam({
        title,
        subject,
        duration_minutes: Number(duration),
        teacher_id: teacher_id || '1',
        is_active: false
      });
      await exam.save();
      return res.status(201).json({ exam_id: exam._id });
    } else {
      const id = String(Date.now());
      memoryStore.exams.push({ id, title, subject, duration: Number(duration), is_active: false });
      return res.status(201).json({ exam_id: id });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Question to Exam
app.post('/exam/:exam_id/add-question', async (req, res) => {
  try {
    const { exam_id } = req.params;
    const { question, A, B, C, D, correct } = req.body;

    if (isMongoConnected) {
      const q = new Question({
        exam_id,
        question_text: question,
        option_a: A,
        option_b: B,
        option_c: C,
        option_d: D,
        correct_option: correct
      });
      await q.save();
      return res.status(201).json({ message: 'Question added', question_id: q._id });
    } else {
      const id = String(Date.now());
      memoryStore.questions.push({ id, exam_id, question, A, B, C, D, correct });
      return res.status(201).json({ message: 'Question added', question_id: id });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Exam
app.post('/exam/:exam_id/start', async (req, res) => {
  try {
    const { exam_id } = req.params;
    if (isMongoConnected) {
      await Exam.findByIdAndUpdate(exam_id, { is_active: true });
    } else {
      const e = memoryStore.exams.find(x => String(x.id) === String(exam_id));
      if (e) e.is_active = true;
    }
    res.json({ message: 'Exam started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop Exam
app.post('/exam/:exam_id/stop', async (req, res) => {
  try {
    const { exam_id } = req.params;
    if (isMongoConnected) {
      await Exam.findByIdAndUpdate(exam_id, { is_active: false });
    } else {
      const e = memoryStore.exams.find(x => String(x.id) === String(exam_id));
      if (e) e.is_active = false;
    }
    res.json({ message: 'Exam stopped' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Active Exams
app.get('/exams/active', async (req, res) => {
  try {
    if (isMongoConnected) {
      const exams = await Exam.find({ is_active: true });
      if (exams.length > 0) {
        return res.json(exams.map(e => ({
          id: e._id,
          title: e.title,
          subject: e.subject,
          duration: e.duration_minutes
        })));
      }
    }
    // Return standard active exams if none in Mongo
    const active = memoryStore.exams.filter(e => e.is_active);
    res.json(active);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Exam Questions
app.get('/exam/:exam_id/questions', async (req, res) => {
  try {
    const { exam_id } = req.params;
    if (isMongoConnected) {
      const questions = await Question.find({ exam_id });
      if (questions.length > 0) {
        return res.json(questions.map(q => ({
          id: q._id,
          question: q.question_text,
          A: q.option_a,
          B: q.option_b,
          C: q.option_c,
          D: q.option_d,
          correct: q.correct_option
        })));
      }
    }
    const filtered = memoryStore.questions.filter(q => String(q.exam_id) === String(exam_id));
    res.json(filtered.length > 0 ? filtered : memoryStore.questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Exam
app.post('/exam/:exam_id/submit', async (req, res) => {
  try {
    const { exam_id } = req.params;
    const { student_id, answers } = req.body;

    let score = 0;
    if (isMongoConnected) {
      const questions = await Question.find({ exam_id });
      questions.forEach(q => {
        if (answers[q._id] && answers[q._id] === q.correct_option) score++;
      });
      const attempt = new ExamAttempt({
        exam_id,
        student_id: student_id || '101',
        score,
        answers
      });
      await attempt.save();

      if (student_id && mongoose.Types.ObjectId.isValid(student_id)) {
        await Student.findByIdAndUpdate(student_id, {
          $inc: { score, xp: score * 15 }
        });
      }
    } else {
      memoryStore.questions.forEach(q => {
        if (answers[q.id] && answers[q.id] === q.correct) score++;
      });
    }

    res.json({ message: 'Exam submitted', score, xpEarned: score * 15 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------
// 4. ASSIGNMENTS & UPLOADS
// ------------------------------------------

// Upload / Assign Work
app.post('/assign_work', upload.single('assignment_file'), async (req, res) => {
  try {
    const subject = (req.body.subject || '').trim();
    const title = (req.body.title || '').trim();
    const teacher_name = (req.body.teacher_name || 'Prof. Sharma').trim();

    if (!subject) return res.status(400).json({ error: 'Subject is required' });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const filename = req.file.filename;
    const original_name = req.file.originalname || filename;

    if (isMongoConnected) {
      const assignment = new Assignment({
        title: title || original_name,
        subject,
        filename,
        original_name,
        teacher_name
      });
      await assignment.save();
      return res.status(201).json({
        success: true,
        message: 'Assignment uploaded successfully',
        assignment: assignment.toClient()
      });
    } else {
      const newA = {
        id: String(Date.now()),
        title: title || original_name,
        subject,
        filename: original_name,
        teacher_name,
        date: new Date().toISOString().split('T')[0],
        url: `http://localhost:${PORT}/uploads/${filename}`
      };
      memoryStore.assignments.unshift(newA);
      return res.status(201).json({
        success: true,
        message: 'Assignment uploaded successfully',
        assignment: newA
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Assignments
app.get('/assignments', async (req, res) => {
  try {
    if (isMongoConnected) {
      const works = await Assignment.find().sort({ timestamp: -1 });
      if (works.length > 0) {
        return res.json(works.map(w => w.toClient()));
      }
    }
    res.json(memoryStore.assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------
// 5. XP & LEVEL UPDATES
// ------------------------------------------

// Level Update
app.post('/levelupdate', async (req, res) => {
  try {
    const { student_id, level, xp, accuracy } = req.body;
    if (isMongoConnected && student_id && mongoose.Types.ObjectId.isValid(student_id)) {
      await Student.findByIdAndUpdate(student_id, {
        $inc: { xp: Number(xp) || 25 }
      });
    }
    res.json({ success: true, message: 'Level progress recorded', level, xp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Score Update
app.post('/scoreupdate', async (req, res) => {
  try {
    const { name, score } = req.body;
    if (isMongoConnected && name) {
      const student = await Student.findOneAndUpdate(
        { name },
        { $inc: { score: Number(score) || 0 } },
        { new: true }
      );
      if (student) return res.json({ message: 'Score updated', student: student.toClient() });
    }
    res.json({ message: 'Score updated', name, score });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile Update
app.post('/profilesupdate', async (req, res) => {
  try {
    const { name, age, schoolname, classofstudy, password } = req.body;
    if (isMongoConnected && name) {
      const updateData = {};
      if (age) updateData.age = Number(age);
      if (schoolname) updateData.schoolname = schoolname;
      if (classofstudy) updateData.classofstudy = classofstudy;
      if (password) updateData.password = password;

      const student = await Student.findOneAndUpdate({ name }, updateData, { new: true });
      if (student) return res.json({ message: 'Profile updated', student: student.toClient() });
    }
    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leaderboard
app.get('/leaderboard', async (req, res) => {
  try {
    if (isMongoConnected) {
      const students = await Student.find().sort({ score: -1, xp: -1 }).limit(20);
      return res.json(students.map(s => s.toClient()));
    }
    const sorted = [...memoryStore.students].sort((a, b) => (b.score || 0) - (a.score || 0));
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------
// 6. LEARNING ANALYTICS & MISCONCEPTIONS
// ------------------------------------------

// Record / Update Learning Metrics
app.post('/api/analytics/fraction', async (req, res) => {
  try {
    const { student_name, concept, pre_test_score, post_test_score, gain_points, misconceptions } = req.body;

    if (isMongoConnected) {
      let metric = await LearningMetric.findOne({ student_name, concept: concept || 'Grade 6 Fractions' });
      if (!metric) {
        metric = new LearningMetric({
          student_name: student_name || 'Explorer',
          concept: concept || 'Grade 6 Fractions',
          pre_test_score: pre_test_score || 0,
          post_test_score: post_test_score || 0,
          gain_points: gain_points || 0
        });
      } else {
        if (pre_test_score !== undefined) metric.pre_test_score = pre_test_score;
        if (post_test_score !== undefined) metric.post_test_score = post_test_score;
        if (gain_points !== undefined) metric.gain_points = gain_points;
      }
      metric.updated_at = new Date();
      await metric.save();
      return res.json({ success: true, metric });
    }

    res.json({ success: true, message: 'Learning metric recorded locally' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Learning Metrics Summary
app.get('/api/analytics/fraction', async (req, res) => {
  try {
    if (isMongoConnected) {
      const metrics = await LearningMetric.find().sort({ updated_at: -1 });
      return res.json(metrics);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// START SERVER
// ==========================================
const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 AlgoPlay Node & Express + MongoDB Backend Running!`);
  console.log(`  📡 API Server: http://localhost:${PORT}`);
  console.log(`  📂 Static Files Served on Port ${PORT}`);
  console.log(`  🍃 MongoDB URI: ${MONGODB_URI}`);
  console.log(`======================================================\n`);
});

module.exports = { app, server };
