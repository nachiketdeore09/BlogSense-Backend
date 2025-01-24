import connectDB from './db/index.js';
import connectAstraDB from './db/astrDB.js';
import dotenv from 'dotenv';
import app from './app.js';

dotenv.config({ path: './env' });

connectDB()
    .then(() => {
        connectAstraDB();
        app.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        });
    })
    .catch((error) => {
        console.log('Error connecting to database, ', error);
    });
