import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(`${process.env.GEMINI_API}`);

const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstructions:
        "You are a smart and creative ai assistant, you are provided with a blog and a question about the blog.You need to generate a response to the question based on the blog content. Provide a complete answer don't keep responses too long or too short. Be creative and informative. Keep your response like you are teaching someone else.",
});

const generateAnswer = async (context, question) => {
    const prompt = `${context}\n\nQ: ${question}\nA:`;
    const result = await model.generateContent({
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: prompt,
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.5,
        },
    });
    // console.log(result.response.text());
    return result.response.text();
};

export default generateAnswer;
