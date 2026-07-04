import express, { Request, Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stellalens';

// Middleware
app.use(cors());
app.use(express.json());

// Basic sanity check route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'StellaLens Celestial Backend is running' });
});

// Post Bespoke Order placeholder endpoint
app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, productId, productName, price, customizations } = req.body;
    
    // Log the received custom order configuration
    console.log('Bespoke order received:', {
      name,
      email,
      phone,
      address,
      productId,
      productName,
      price,
      customizations
    });

    res.status(201).json({
      message: 'Bespoke order captured successfully',
      data: { name, email, productName, price, customizations }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process custom order request' });
  }
});

// Connect to MongoDB & Start Server
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection error:', err);
    // Fallback: Start the server anyway in dev mode
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} (without Database)`);
    });
  });
