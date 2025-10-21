import mongoose from "mongoose";
import crypto from "crypto";

// --- Utility Functions ---
const generateSha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const analyzeString = (value) => {
  const cleanValue = value || "";

  // Count characters
  const length = cleanValue.length;

  // Palindrome check (ignores case and spaces)
  const is_palindrome =
    cleanValue.replace(/\s+/g, "").toLowerCase() ===
    cleanValue.replace(/\s+/g, "").toLowerCase().split("").reverse().join("");

  // Count unique characters (excluding spaces)
  const unique_characters = new Set(cleanValue.replace(/\s+/g, "").split("")).size;

  // Count words
  const word_count =
    cleanValue.trim() === "" ? 0 : cleanValue.trim().split(/\s+/).length;

  // Character frequency map
  const char_freq = {};
  for (const ch of cleanValue) {
    if (ch !== " ") {
      char_freq[ch] = (char_freq[ch] || 0) + 1;
    }
  }

  return {
    length,
    is_palindrome,
    unique_characters,
    word_count,
    sha256_hash: generateSha256(cleanValue),
    character_frequency_map: char_freq,
  };
};

// --- Schema Definition ---
const StringAnalysisSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    value: { type: String, required: true },
    properties: {
      length: Number,
      is_palindrome: Boolean,
      unique_characters: Number,
      word_count: Number,
      sha256_hash: String,
      character_frequency_map: { type: Map, of: Number },
    },
    created_at: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        delete ret._id; 
      },
    },
    toObject: {
      transform(doc, ret) {
        delete ret._id; 
      },
    },
  }
);

// --- Pre-save Hook to Auto-generate Data ---
StringAnalysisSchema.pre("save", function (next) {
  if (this.isModified("value")) {
    const analysis = analyzeString(this.value);
    this.id = generateSha256(this.value);
    this.properties = analysis;
  }
  next();
});

export const StringAnalysis = mongoose.model(
  "StringAnalysis",
  StringAnalysisSchema
);
