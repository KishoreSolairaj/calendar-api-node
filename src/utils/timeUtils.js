import { DEFAULT_BUFFER_MINUTES, WORK_START_HOUR, WORK_END_HOUR } from '../config/defaults.js';
export const isOverlapping = (start1, end1, start2, end2) => {
    const s1 = new Date(start1);
    const e1 = new Date(end1);
    const s2 = new Date(start2);
    const e2 = new Date(end2);


    return s1 < e2 && e1 > s2;
};


export const addBuffer = (time, minutes) => {
    return new Date(new Date(time).getTime() + minutes * 60000);
};





