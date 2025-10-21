import e from 'express';
import { StringAnalysis } from '../models/string.schema.js';
import { parseNaturalQuery } from '../utils/parseNaturalQuery.js';

const isValidString = (input) => {
  return /^[A-Za-z\s]+$/.test(input.trim());
}


export const analyzeString = async (req, res) => {
    try {
        const { value } = req.body;
        if (value == "" || value == null) {
            return res.status(400).json({ error: 'Invalid request body or missing "value" field' });
        }
        const analysis = await StringAnalysis.findOne({ value });
        if (analysis) {
            return res.status(409).json({ error: 'String already exists in the system' });
        }
        if (typeof value !== 'string' || !isValidString(value)) {
            return res.status(422).json({ error: 'Invalid data type for "value" (must be string)' });
        }

        const newAnalysis = new StringAnalysis({ value });
        await newAnalysis.save();
        return res.status(201).json(newAnalysis);

    } catch (error) {
        console.error('Error analyzing string:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
};

export const getString = async (req, res) => {
    try {
        const { string_value } = req.params;    
        const analysis = await StringAnalysis.findOne({ value: string_value });
        if (!analysis) {
            return res.status(404).json({ error: 'String does not exist in the system' });
        }
        return res.status(200).json(analysis);
    } catch (error) {
        console.error('Error retrieving string analysis:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
};

export const getAllStrings = async (req, res) => {
   try {
    const validParams = [
      "is_palindrome",
      "min_length",
      "max_length",
      "word_count",
      "contains_character",
    ];

    const {
      is_palindrome,
      min_length,
      max_length,
      word_count,
      contains_character,
      ...invalidParams
    } = req.query;

    // Reject unknown parameters
    if (Object.keys(invalidParams).length > 0) {
      return res.status(400).json({
        error: "Invalid query parameter values or types",
        invalid_parameters: Object.keys(invalidParams),
      });
    }

    const filter = {};
    const filtersApplied = {};

    // Validate and apply filters
    if (is_palindrome !== undefined) {
      if (!["true", "false"].includes(is_palindrome)) {
        return res.status(400).json({
          error: 'Invalid query parameter values or types (is_palindrome must be "true" or "false")',
        });
      }
      const boolValue = is_palindrome === "true";
      filter["properties.is_palindrome"] = boolValue;
      filtersApplied.is_palindrome = boolValue;
    }

    if (min_length !== undefined) {
      const num = Number(min_length);
      if (isNaN(num) || num < 0)
        return res.status(400).json({
          error: "Invalid query parameter values or types (min_length must be a positive number)",
        });
      filter["properties.length"] = { ...(filter["properties.length"] || {}), $gte: num };
      filtersApplied.min_length = num;
    }

    if (max_length !== undefined) {
      const num = Number(max_length);
      if (isNaN(num) || num < 0)
        return res.status(400).json({
          error: "Invalid query parameter values or types (max_length must be a positive number)",
        });
      filter["properties.length"] = { ...(filter["properties.length"] || {}), $lte: num };
      filtersApplied.max_length = num;
    }

    if (word_count !== undefined) {
      const num = Number(word_count);
      if (isNaN(num) || num < 0)
        return res.status(400).json({
          error: "Invalid query parameter values or types (word_count must be a positive number)",
        });
      filter["properties.word_count"] = num;
      filtersApplied.word_count = num;
    }

    if (contains_character !== undefined) {
      if (!/^[A-Za-z]$/.test(contains_character)) {
        return res.status(400).json({
          error: "Invalid query parameter values or types (contains_character must be a single letter)",
        });
      }
      filter.value = { $regex: contains_character, $options: "i" };
      filtersApplied.contains_character = contains_character;
    }

    // Query the DB (excluding _id)
    const analyses = await StringAnalysis.find(filter).select("-_id");

    return res.status(200).json({
        data: analyses,
        count: analyses.length,
        filters_applied: Object.keys(filtersApplied).length ? filtersApplied : {},
    });
  } catch (error) {
    console.error("Error retrieving all string analyses:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

export const getStringsNlp = async (req, res) => {
  try {
    const query = req.query.query?.trim();
    if (!query)
      return res.status(400).json({ message: 'Missing query parameter' });

    // Parse natural language query
    const result = parseNaturalQuery(query);
    if (!result || !result.parsed_filters)
      return res.status(400).json({
        message: 'Unable to parse natural language query',
      });

    const { parsed_filters } = result;

    // --- Validation checks ---
    if (
      parsed_filters.min_length &&
      parsed_filters.max_length &&
      parsed_filters.min_length > parsed_filters.max_length
    ) {
      return res.status(422).json({
        message: 'Query parsed but resulted in conflicting filters',
      });
    }

    // --- Build MongoDB filter dynamically ---
    const mongoFilter = {};

    if (parsed_filters.is_palindrome !== undefined) {
      mongoFilter['properties.is_palindrome'] = parsed_filters.is_palindrome;
    }

    if (parsed_filters.word_count) {
      mongoFilter['properties.word_count'] = parsed_filters.word_count;
    }

    if (parsed_filters.min_length || parsed_filters.max_length) {
      mongoFilter['properties.length'] = {
        ...(parsed_filters.min_length ? { $gte: parsed_filters.min_length } : {}),
        ...(parsed_filters.max_length ? { $lte: parsed_filters.max_length } : {}),
      };
    }

    if (parsed_filters.contains_character) {
      try {
        const char = parsed_filters.contains_character;
        // Escape regex special characters safely
        const safeChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        mongoFilter['value'] = new RegExp(safeChar, 'i');
      } catch {
        return res.status(400).json({
          message: 'Invalid character pattern in query',
        });
      }
    }

    // --- Execute Query ---
    const data = await StringAnalysis.find(mongoFilter).select('-_id -__v');

    return res.status(200).json({
      data,
      count: data.length,
      interpreted_query: {
        original: query,
        parsed_filters,
      },
    });
  } catch (error) {
    console.error('NLP Query Error:', error);

    if (error.name === 'ValidationError') {
      return res
        .status(400)
        .json({ message: 'Invalid query parameter values or types' });
    }

    // Check both error.status and error.statusCode for compatibility
    const statusCode = error.status || error.statusCode;

    if (statusCode === 400) {
      return res
        .status(400)
        .json({ message: 'Unable to parse natural language query' });
    }

    if (statusCode === 422) {
      return res
        .status(422)
        .json({ message: 'Query parsed but resulted in conflicting filters' });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteString = async (req, res) => {
    try {
        const { string_value } = req.params;    
        const analysis = await StringAnalysis.findOneAndDelete({ value: string_value });
        if (!analysis) {
            return res.status(404).json({ error: 'String does not exist in the system' });
        }
        return res.status(204).send();
    } catch (error) {
        console.error('Error deleting string analysis:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
};