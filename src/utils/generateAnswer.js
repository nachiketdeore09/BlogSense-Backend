import ollama from 'ollama';

const generateAnswer = async (context, question) => {
    const response = await ollama.chat({
        model: 'mistral', // or "llama2"
        messages: [
            {
                role: 'system',
                content:
                    "You are a helpful assistant. Answer questions strictly based on the provided context.If the context does not contain relevant information, say 'I don't know based on the provided context.' Do not generate or assume any information beyond the context.",
            },
            {
                role: 'user',
                content: `Context: ${context}\n\nQuestion: ${question}`,
            },
        ],
    });

    console.log(response)

    return response.message.content;
};


export default generateAnswer;
