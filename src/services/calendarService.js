// Simple in-memory calendar store


const events = [];


export const addEvent = (event) => {
events.push(event);
};


export const getEvents = () => {
return events;
};