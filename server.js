import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import stringRoutes from "./routes/string.routes.js";

dotenv.config();
const app = express();
app.use(cors())
app.use(express.json());

const PORT = process.env.PORT || 3000;

// connect MongoDB
mongoose.connect(process.env.MONGO_URI).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

app.use("/strings", stringRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
