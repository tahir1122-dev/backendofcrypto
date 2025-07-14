
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
dotenv.config();
import userRoutes from './routes/user.route.js';
import productRoutes from './routes/product.route.js';
import authRoutes from './routes/auth.route.js';
import chatRoutes from './routes/chat.route.js';
import orderRoutes from './routes/order.route.js';
import { connectDB } from './lib/db.js';
import { createAdmin } from './controllers/user.controller.js';

const app = express();
app.use(cookieParser());


app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.json({ limit: '10mb' })); // or higher, e.g. '20mb'


// --- BEGIN: Improved allowedOrigins and CORS logic ---
const allowedOrigins = [
  'https://wolverine-house.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://192.168.18.118:5173'
];

// Add any custom frontend URL from environment
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    console.log('🔍 Request origin:', origin); // Debug log
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all localhost and 127.0.0.1 requests in development
    if (process.env.NODE_ENV !== 'production') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.startsWith('http://192.168.')) {
        console.log('✅ Local development origin allowed:', origin);
        return callback(null, true);
      }
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log('✅ Origin allowed:', origin);
      return callback(null, true);
    }
    
    // Allow any netlify.app domain
    if (origin.includes('.netlify.app')) {
      console.log('✅ Netlify domain allowed:', origin);
      return callback(null, true);
    }
    
    console.log('❌ Origin not allowed by CORS:', origin);
    console.log('🔧 Allowed origins:', allowedOrigins);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));
// --- END: Improved allowedOrigins and CORS logic ---

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  console.log('🔄 Preflight request from:', req.headers.origin);
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

const PORT = process.env.PORT || 5001;

// Add a test route for health check
app.get('/', (req, res) => {
  res.json({
    message: 'Backend is working now!',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});


// API Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/orders', orderRoutes); // Add this line

// Create HTTP server
const server = createServer(app);

// Create Socket.io server
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin
      if (!origin) return callback(null, true);
      
      // Allow localhost and development origins
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.startsWith('http://192.168.')) {
        return callback(null, true);
      }
      
      // Allow netlify domains
      if (origin.includes('.netlify.app')) {
        return callback(null, true);
      }
      
      // Allow specific origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
});

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Socket.io connection handling
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.id}`);

  // Add user to online users
  onlineUsers.set(socket.user.id, socket.id);
  socket.join(socket.user.id);

  // Handle new messages
  socket.on('send_message', ({ conversationId, recipientId, content }) => {
    if (onlineUsers.has(recipientId)) {
      io.to(recipientId).emit('new_message', {
        conversationId,
        senderId: socket.user.id,
        content,
        createdAt: new Date()
      });
    }
  });

  // Handle typing
  socket.on('typing', ({ conversationId, recipientId }) => {
    if (onlineUsers.has(recipientId)) {
      io.to(recipientId).emit('typing', {
        conversationId,
        userId: socket.user.id
      });
    }
  });

  socket.on('stop_typing', ({ conversationId, recipientId }) => {
    if (onlineUsers.has(recipientId)) {
      io.to(recipientId).emit('stop_typing', {
        conversationId,
        userId: socket.user.id
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.id}`);
    onlineUsers.delete(socket.user.id);
  });
});

// Database initialization with fallback
const initializeApp = async () => {
  try {
    await connectDB();
    await createAdmin();
    console.log('✅ Database and admin initialized');
  } catch (err) {
    console.error('❌ MongoDB Atlas connection failed:', err.message);
    console.log('🔄 Server will start anyway for development...');
    console.log('💡 Try these solutions:');
    console.log('   1. Use mobile hotspot');
    console.log('   2. Change DNS to 8.8.8.8');
    console.log('   3. Try again later when internet is stable');
  }
};

// Start server
initializeApp().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});