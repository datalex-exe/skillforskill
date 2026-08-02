// server.js – express server serving APIs and frontend static files
const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Initialize Database connection and auto table setup
require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve Uploads directory (profile images, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Determine the correct frontend directory path (handling both lowercase and uppercase variations due to Git casing behavior on Windows/Linux)
const fs = require('fs');
let frontendDir = path.join(__dirname, '..', 'frontend');
if (!fs.existsSync(frontendDir)) {
  const uppercaseDir = path.join(__dirname, '..', 'FRONTEND');
  if (fs.existsSync(uppercaseDir)) {
    frontendDir = uppercaseDir;
  }
}

// Serve CSS files from CSS directory
app.use('/css', express.static(path.join(frontendDir, 'css')));
// Serve JS files from JS directory
app.use('/js', express.static(path.join(frontendDir, 'js')));
// Serve Images from images directory
app.use('/images', express.static(path.join(frontendDir, 'images')));

// API Routes
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

// Database instance status (detect database resets/recreations)
const { dbInstanceId } = require('./config/db');
app.get('/api/status', (req, res) => {
    res.json({ success: true, dbInstanceId });
});

// Serve HTML files from HTML directory
app.use(express.static(path.join(frontendDir, 'html')));

// Fallback to index.html for any unknown routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'html', 'index.html'));
});

// Setup HTTP server and Socket.IO
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Bind io instance to express app context
app.set('io', io);

// Socket.IO event handler
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Register user into their personal notification room
  socket.on('register', (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`👤 User registered: user_${userId} (Socket: ${socket.id})`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Background session schedule checker
const { dbQuery } = require('./config/db');
setInterval(async () => {
  try {
    const scheduledSessions = await dbQuery.all("SELECT * FROM sessions WHERE status = 'scheduled'");
    const now = new Date();

    for (const session of scheduledSessions) {
      const sessionDateStr = session.date;
      const startTimeStr = session.time.split(" - ")[0];
      const scheduledTime = new Date(`${sessionDateStr}T${startTimeStr}:00`);

      if (now >= scheduledTime) {
        console.log(`⏰ Starting Session ${session.id}. Room ID: ${session.room_id}`);

        // Update status in SQLite to active
        await dbQuery.run("UPDATE sessions SET status = 'active' WHERE id = ?", [session.id]);

        // Get full details to construct user payload
        const updatedSession = await dbQuery.get(
          `SELECT s.*, 
                  u1.first_name as sender_first_name, u1.last_name as sender_last_name, u1.avatar as sender_avatar,
                  u2.first_name as recipient_first_name, u2.last_name as recipient_last_name, u2.avatar as recipient_avatar
           FROM sessions s
           JOIN users u1 ON s.sender_id = u1.id
           JOIN users u2 ON s.recipient_id = u2.id
           WHERE s.id = ?`,
          [session.id]
        );

        if (updatedSession) {
          const payload = {
            id: updatedSession.id,
            requestId: updatedSession.request_id,
            senderId: updatedSession.sender_id,
            recipientId: updatedSession.recipient_id,
            skill: updatedSession.skill,
            date: updatedSession.date,
            time: updatedSession.time,
            roomId: updatedSession.room_id,
            status: 'active',
            senderName: `${updatedSession.sender_first_name} ${updatedSession.sender_last_name}`,
            recipientName: `${updatedSession.recipient_first_name} ${updatedSession.recipient_last_name}`,
            senderAvatar: updatedSession.sender_avatar,
            recipientAvatar: updatedSession.recipient_avatar
          };

          // Notify sender and recipient via Socket.IO
          io.to(`user_${session.sender_id}`).emit('session_start_notification', payload);
          io.to(`user_${session.recipient_id}`).emit('session_start_notification', payload);
        }
      }
    }
  } catch (err) {
    console.error("❌ Scheduled checker error:", err);
  }
}, 10000);

// Midnight automatic limit reset notification schedule (IST Asia/Kolkata)
let lastResetDateStr = "";
setInterval(() => {
  const d = new Date();
  const istDate = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  const todayStr = istDate.toISOString().split('T')[0];

  if (lastResetDateStr && lastResetDateStr !== todayStr) {
    console.log(`🌙 12:00 AM Midnight IST reached! Resetting daily video call usage for date: ${todayStr}`);
    if (io) {
      io.emit('daily_limit_reset', { date: todayStr, message: 'Daily video call limits have reset for the new day!' });
    }
  }
  lastResetDateStr = todayStr;
}, 30000);

server.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`🚀 Skill-for-Skill Server is running!`);
  console.log(`🔗 Local Server: http://localhost:${PORT}`);
  console.log(`================================================`);
});
