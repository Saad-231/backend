const express = require('express');
const cors = require('cors');
const path = require('path');

const config = require('./config/env');
const chatRoutes = require('./routes/chatRoutes');
const historyRoutes = require('./routes/historyRoutes');
const imageRoutes = require('./routes/imageRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS کی بالکل صحیح سیٹنگ
app.use(
  cors({
    origin: ['http://localhost:5173', 'https://frontend-nine-beta-21.vercel.app'],
    credentials: true,
  })
);

app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'NovaScribe.AI backend' });
});

app.use('/api/chat', chatRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/image', imageRoutes);
app.use('/api/upload', uploadRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use(errorHandler);

module.exports = app;
