import { response } from "express";

class LangflowClient {
    constructor(baseURL, applicationToken) {
        this.baseURL = baseURL;
        this.applicationToken = applicationToken;
    }
    async post(
        endpoint,
        body,
        headers = { 'Content-Type': 'application/json' },
    ) {
        headers['Authorization'] = `Bearer ${this.applicationToken}`;
        headers['Content-Type'] = 'application/json';
        const url = `${this.baseURL}${endpoint}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
            });

            const responseMessage = await response.json();
            if (!response.ok) {
                throw new Error(
                    `${response.status} ${
                        response.statusText
                    } - ${JSON.stringify(responseMessage)}`,
                );
            }
            return responseMessage;
        } catch (error) {
            console.error('Request Error:', error.message);
            throw error;
        }
    }

    async initiateSession(
        flowId,
        langflowId,
        inputValue,
        inputType = 'chat',
        outputType = 'chat',
        stream = false,
        tweaks = {},
    ) {
        const endpoint = `/lf/${langflowId}/api/v1/run/${flowId}?stream=${stream}`;
        return this.post(endpoint, {
            input_value: inputValue,
            input_type: inputType,
            output_type: outputType,
            tweaks: tweaks,
        });
    }

    handleStream(streamUrl, onUpdate, onClose, onError) {
        const eventSource = new EventSource(streamUrl);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onUpdate(data);
        };

        eventSource.onerror = (event) => {
            console.error('Stream Error:', event);
            onError(event);
            eventSource.close();
        };

        eventSource.addEventListener('close', () => {
            onClose('Stream closed');
            eventSource.close();
        });

        return eventSource;
    }

    async runFlow(
        flowIdOrName,
        langflowId,
        inputValue,
        inputType = 'chat',
        outputType = 'chat',
        tweaks = {},
        stream = false,
        onUpdate,
        onClose,
        onError,
    ) {
        try {
            const initResponse = await this.initiateSession(
                flowIdOrName,
                langflowId,
                inputValue,
                inputType,
                outputType,
                stream,
                tweaks,
            );
            console.log('Init Response:', initResponse);
            if (
                stream &&
                initResponse &&
                initResponse.outputs &&
                initResponse.outputs[0].outputs[0].artifacts.stream_url
            ) {
                const streamUrl =
                    initResponse.outputs[0].outputs[0].artifacts.stream_url;
                console.log(`Streaming from: ${streamUrl}`);
                this.handleStream(streamUrl, onUpdate, onClose, onError);
            }
            return initResponse;
        } catch (error) {
            console.error('Error running flow:', error);
            onError('Error initiating session');
        }
    }
}

const langflowClient = new LangflowClient(
    'https://api.langflow.astra.datastax.com', // Base URL
    process.env.APPLICATION_TOKEN, // Application Token
);

// async function main(
//     inputValue,
//     inputType = 'chat',
//     outputType = 'chat',
//     stream = false,
// ) {
//     const flowIdOrName = 'a74ad2bc-b2d0-4b90-9907-eca94faa772c';
//     const langflowId = 'ac642471-cc7a-43f6-8f47-630d8f0938a3';
//     const applicationToken =
//         'AstraCS:sWNZOUmEEoGvgYWruBhjzcEX:cb288795e84c10656beff437b41a260557a4c1cee531bcf90382eefe1571dc88';
//     const langflowClient = new LangflowClient(
//         'https://api.langflow.astra.datastax.com',
//         applicationToken,
//     );

//     try {
//         const tweaks = {
//             'ChatInput-I5MlI': {},
//             'AstraDB-tJHgH': {},
//             'AstraDB-M5ehW': {},
//             'Google Generative AI Embeddings-d4s0S': {},
//             'Google Generative AI Embeddings-fBrRP': {},
//             'ParseData-En5T6': {},
//             'Prompt-K052V': {},
//             'GoogleGenerativeAIModel-wND7R': {},
//             'ChatOutput-AajDq': {},
//             'CustomComponent-Fkz7R': {},
//             'TextOutput-8zcKx': {},
//             'File-vYTV7': {},
//         };
//         response = await langflowClient.runFlow(
//             flowIdOrName,
//             langflowId,
//             inputValue,
//             inputType,
//             outputType,
//             tweaks,
//             stream,
//             (data) => console.log('Received:', data.chunk), // onUpdate
//             (message) => console.log('Stream Closed:', message), // onClose
//             (error) => console.log('Stream Error:', error), // onError
//         );
//         console.log(response)
//         if (!stream && response && response.outputs) {
//             const flowOutputs = response.outputs[0];
//             const firstComponentOutputs = flowOutputs.outputs[0];
//             const output = firstComponentOutputs.outputs.message;

//             console.log('Final Output:', output.message.text);
//         }
//     } catch (error) {
//         console.error('Main Error', error.message);
//     }
// }

// export default main;

export default langflowClient;