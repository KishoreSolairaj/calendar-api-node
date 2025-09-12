export default function validateBody(req, res, next) {
  const { start, end, participants } = req.body;

  if (!start || !end || !participants || !Array.isArray(participants)) {
    return res.status(400).json({ error: 'Invalid body. Required: start, end, participants[]' });
  }

  const startTime = new Date(start);
  const endTime = new Date(end);

  // Check if date is valid
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return res.status(400).json({ error: 'Invalid start or end datetime' });
  }



  // Convert env variables to numbers (process.env are strings)
  const workingStart = Number(process.env.WORKING_START) || 9;
  const workingEnd = Number(process.env.WORKING_END) || 17;
// start.toDateString() === end.toDateString()
  // Check if start and end are within working hours
  // If NOT within working hours, return error
  if(startTime.getUTCHours()>endTime.getUTCHours()){
    return res.status(400).json({ error: `Start and End Time was not match the requirement` });
  }
  if (startTime.getUTCHours() < workingStart || endTime.getUTCHours() > workingEnd || startTime.toDateString() != endTime.toDateString()) {
    return res.status(400).json({ error: `Meeting must be scheduled within working hours (${workingStart} AM - ${workingEnd} PM)` });
  }

  // All good, continue
  next();
}
