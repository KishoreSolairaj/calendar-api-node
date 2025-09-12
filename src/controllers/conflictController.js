import { addEvent, getEvents } from '../services/calendarService.js';
import { detectConflictss, suggestAlternativeTimes } from '../services/conflictService.js';


export const checkConflicts = (req, res) => {
    const proposedEvent = req.body;
    const conflicts = detectConflictss(proposedEvent);


    if (conflicts.length > 0) {
        return res.status(200).json({
            message: 'Conflicts detected',
            conflicts
        });
    }


    addEvent(proposedEvent);
    return res.status(201).json({ message: 'Event added successfully', proposedEvent });
};


export const suggestTimes = (req, res) => {
    const proposedEvent = req.body;
    const suggestions = suggestAlternativeTimes(proposedEvent);

    return res.status(200).json({
        message: 'Suggested times',
        suggestions
    });
};


