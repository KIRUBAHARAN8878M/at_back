const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Task } = require('./models');
const cors = require('cors');  // Moved here for better structure

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = 'your_secret_key';
const { sequelize } = require('./models');



// Middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all origins

// JWT Authentication Middleware
const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Extract token from "Bearer <token>" format
  if (token) {
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) {
        return res.sendStatus(403); // Forbidden
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401); // Unauthorized
  }
};

// Routes
app.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ name, email, password: hashedPassword, role });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: 'User already exists' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (user && (await bcrypt.compare(password, user.password))) {
    const token = jwt.sign({ userId: user.id, role: user.role }, SECRET_KEY);
    res.json({ token, role: user.role });
  } else {
    res.status(400).json({ error: 'Invalid credentials' });
  }
});


app.get('/admin/dashboard', authenticateJWT, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.sendStatus(403); // Forbidden
  }
  
  try {
    // Fetch dashboard statistics
    const activeUsers = await User.count();
    const totalTasks = await Task.count();
    
    // Fetch all tasks with user details
    const tasks = await Task.findAll({ include: User });

    res.json({ activeUsers, totalTasks, tasks });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/users', authenticateJWT, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.sendStatus(403); // Forbidden
  }
  const users = await User.findAll({ include: Task });
  res.json(users);
});

app.post('/users', authenticateJWT, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.sendStatus(403); // Forbidden
  }
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ name, email, password: hashedPassword, role: 'user' });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: 'User already exists' });
  }
});

app.put('/tasks/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const task = await Task.findByPk(id);
  if (!task) {
    return res.sendStatus(404); // Not Found
  }
  if (req.user.role !== 'admin' && task.userId !== req.user.userId) {
    return res.sendStatus(403); // Forbidden
  }
  task.status = status;
  await task.save();
  res.json(task);
});

app.get('/tasks', authenticateJWT, async (req, res) => {
  try {
    const tasks = await Task.findAll({ where: { userId: req.user.userId } });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New endpoint to create a task
app.post('/tasks', authenticateJWT, async (req, res) => {
  const { title, status } = req.body;
  try {
    const task = await Task.create({ title, status, userId: req.user.userId });
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(400).json({ error: 'Error creating task' });
  }
});


// In server.js
app.get('/admin/dashboard/tasks', authenticateJWT, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.sendStatus(403);
  }
  const tasks = await Task.findAll({ include: User });
  res.json(tasks);
});

app.put('/admin/dashboard/tasks/:id/status', authenticateJWT, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.sendStatus(403);
  }
  const { id } = req.params;
  const { status } = req.body;
  const task = await Task.findByPk(id);
  if (!task) {
    return res.sendStatus(404);
  }
  task.status = status;
  await task.save();
  res.json(task);
});


app.put('/users/:id', authenticateJWT, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.sendStatus(403); // Forbidden
  }
  const { id } = req.params;
  const { name, email, password, role } = req.body;
  const user = await User.findByPk(id);
  if (!user) {
    return res.sendStatus(404); // Not Found
  }
  user.name = name;
  user.email = email;
  user.role = role;
  if (password) {
    user.password = await bcrypt.hash(password, 10); // Hash the new password if provided
  }
  await user.save();
  res.json(user);
});


sequelize.sync({ force: false }).then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});

