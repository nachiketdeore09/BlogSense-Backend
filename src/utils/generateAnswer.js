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

const enhanceBlog = async (blogText) => {
    const prompt = `
        You are an expert content editor and writer.
        Your task: Take the given blog text and return ONLY an improved version.
        Rules:
        - Keep all facts and meaning exactly the same.
        - Improve grammar, clarity, vocabulary, and flow.
        - Output must be a single continuous paragraph.
        - Do NOT explain your changes.
        - Do NOT list errors, suggestions, or bullet points.
        - Do NOT provide alternative versions.
        - Your ENTIRE output should be the improved blog text only.


        Blog text:
        "${blogText}"
        `;

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
            temperature: 0.4, // Lower temperature for more consistent, accurate edits
        },
    });
    // console.log(result.response.text());

    return result.response.text();
};



//TODOS:
// 1. langraph agent for genrate response
// 2. Web search automation
// 3. Blog Copilot
// 4. frontend integration
// 5. Get_id route for blog
// 6. AI-powered Blog Summarization
// 7. AI-generated Images for Blogs :
//   Integrate DALL·E or Stable Diffusion to generate blog cover images based on the blog’s content.
//   Perfect for users who don’t have their own graphics.

export { generateAnswer, enhanceBlog, summarizeBlog };
