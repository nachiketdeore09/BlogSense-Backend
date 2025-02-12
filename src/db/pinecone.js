import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
const model = 'multilingual-e5-large';

async function generateEmbedding(title, content) {
    const text = [`${title}. ${content}`];
    const embeddings = await pinecone.inference.embed(
        model,
        text,
        { inputType: 'passage', truncate: 'END' },
    );

    return embeddings[0].values;
}

export { pinecone, index, generateEmbedding };

// Convert the text into numerical vectors that Pinecone can index



