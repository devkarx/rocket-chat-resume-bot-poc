import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { IPreFileUpload, IFileUploadContext } from '@rocket.chat/apps-engine/definition/uploads';

export class UploadHandler implements IPreFileUpload {

    public async executePreFileUpload(
        context: IFileUploadContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<void> {

        const file = context.file;
        console.log(`Processing file: ${file.name}`);

        // 1. Validate File Type
        if (file.type !== "application/pdf") {
            throw new Error('Only PDF files are allowed');
        }

        // 2. Get the Room Object (Required to send messages)
        const room = await read.getRoomReader().getById(file.rid);
        if (!room) {
            throw new Error('Room not found');
        }

        // 3. Send "Analyzing..." notification
        const messageBuilder = modify.getCreator().startMessage()
            .setRoom(room)
            .setText(`**I see your PDF:** _${file.name}_. Analyzing...`);

        await modify.getCreator().finish(messageBuilder);

        // 4. Prepare AI Payload
        // Use host.docker.internal to reach Ollama on the laptop
        const OLLAMA_URL = 'http://host.docker.internal:11434/api/generate';
        const payload = {
            model: "mistral",
            prompt: `User uploaded a pdf named ${file.name}. Tell a professional joke about it`,
            stream: false
        };

        // 5. Call AI and Reply
        try {
            const response = await http.post(OLLAMA_URL, {
                headers: { 'Content-Type': 'application/json' },
                content: JSON.stringify(payload)
            });

            if (!response.content) throw new Error("No content from AI");

            const data = JSON.parse(response.content);
            const aiText = data.response;

            // 6. Send Final Reply
            const reply = modify.getCreator().startMessage()
                .setRoom(room)
                .setText(aiText);

            await modify.getCreator().finish(reply);

        } catch (error) {
            console.log("AI connection failed", error);
        }
    }
}
