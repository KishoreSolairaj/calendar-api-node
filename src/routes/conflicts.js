import { Router } from 'express';
import { checkConflicts, suggestTimes } from '../controllers/conflictController.js';
import validateBody from '../middleware/validateBody.js';


const router = Router();


router.post('/check-conflicts', validateBody, checkConflicts);
router.post('/suggest-times', validateBody, suggestTimes);


export default router;