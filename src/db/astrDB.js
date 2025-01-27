import { DataAPIClient } from '@datastax/astra-db-ts';

// Initialize the client
const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN);
export const db = client.db(
    'https://d178fedd-0a5d-4640-9067-af8f29002fb9-us-east-2.apps.astra.datastax.com',
);

const connectAstraDB = async () => {
    const colls = db.collection('blog');
    console.log('Connected to AstraDB:', colls['collectionName']);
};

export default connectAstraDB;
