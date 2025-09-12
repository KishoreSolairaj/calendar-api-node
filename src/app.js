import express from 'express';
import conflictRoutes from './routes/conflicts.js';


const app = express();


app.use(express.json());


app.use('/api', conflictRoutes);


app.get('/', (req, res) => {
res.send('Calendar Conflict Resolver API');
});


export default app;