import express from 'express';
import { 
    analyzeString, 
    getString, 
    getAllStrings, 
    getStringsNlp, 
    deleteString 
} from '../controllers/string.controller.js';

const router = express.Router();
router.post('/', analyzeString);
router.get('/', getAllStrings);
router.get('/filter-by-natural-language', getStringsNlp)
router.get('/:string_value', getString)
router.delete('/:string_value', deleteString)

export default router;