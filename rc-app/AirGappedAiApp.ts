import {
    IAppAccessors,
    IConfigurationExtend,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { IPreFileUpload, IFileUploadContext } from '@rocket.chat/apps-engine/definition/uploads';
// UI Imports for the Search Card
import { BlockElementType, BlockType, TextObjectType } from '@rocket.chat/ui-kit';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';

// ==========================================
// 1. MAIN APP CLASS (MUST BE EXPORTED FIRST)
// ==========================================
export class AirGappedApp extends App implements IPreFileUpload {

    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    // --- A. REGISTER COMMANDS ---
    public async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
        await configuration.slashCommands.provideSlashCommand(new UploadResumeCommand());
        await configuration.slashCommands.provideSlashCommand(new PingCommand());
        await configuration.slashCommands.provideSlashCommand(new SearchResumeCommand());
    }

    // --- B. HANDLE FILE UPLOADS ---
    public async executePreFileUpload(
        context: IFileUploadContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<void> {

        const file = context.file;
        // Filter: Only process PDFs
        if (file.type !== "application/pdf") return;

        const room = await read.getRoomReader().getById(file.rid);
        if (!room) return;

        // Notify user "Reading..."
        const messageBuilder = modify.getCreator().startMessage()
            .setRoom(room)
            .setText(`**Reading:** _${file.name}_...`);
        await modify.getCreator().finish(messageBuilder);

        try {
            // 1. Get File Content (Base64)
            const buffer = context.content;
            const base64String = buffer.toString('base64');

            // 2. Define Backend URL (Using Port 8000 & /api/resume)
            const BACKEND_URL = 'http://host.docker.internal:8000/api/resume/ingest'; 

            // 3. Send to Node Backend
            const ingestResponse = await http.post(BACKEND_URL, {
                headers: { 'Content-Type': 'application/json' },
                content: JSON.stringify({
                    fileBase64: base64String, 
                    candidateName: file.name.replace(".pdf", ""),
                    filename: file.name
                })
            });

            // 4. Report Status
            let dbStatus = "❌ DB Save Failed";
            let aiSummary = "";

            if (ingestResponse.statusCode === 200 || ingestResponse.statusCode === 201) {
                dbStatus = "✅ Saved to Database";
                if(ingestResponse.content) {
                    const responseData = JSON.parse(ingestResponse.content);
                    // Adjust key based on what your backend actually returns
                    aiSummary = responseData.summary || responseData.text || ""; 
                }
            }

            // 5. Final Reply
            const reply = modify.getCreator().startMessage()
                .setRoom(room)
                .setText(`**Status:** ${dbStatus}\n\n${aiSummary}`);
            await modify.getCreator().finish(reply);

        } catch (error) {
            this.getLogger().error(error);
            const errorMsg = modify.getCreator().startMessage()
                .setRoom(room)
                .setText(`❌ **Failed:** ${error.message || error}`);
            await modify.getCreator().finish(errorMsg);
        }
    }
}

// ==========================================
// 2. HELPER COMMANDS (INLINE CLASSES)
// ==========================================

class PingCommand implements ISlashCommand {
    public command = 'ping';
    public i18nDescription = "Checks if bot is alive";
    public i18nParamsExample = " ";
    public providesPreview = false;

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persistence: IPersistence
    ): Promise<void> {
        const builder = modify.getCreator().startMessage()
            .setSender(context.getSender())
            .setRoom(context.getRoom())
            .setText("Ponggg!!! 🏓 (Port 8000 Configured)");
        await modify.getCreator().finish(builder);
    }
}

class UploadResumeCommand implements ISlashCommand {
    public command = 'resume-upload';
    public i18nParamsExample = '';
    public i18nDescription = 'Instructions on how to upload a resume';
    public providesPreview = false;

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<void> {
        const user = context.getSender();
        const room = context.getRoom();
        const appUser = await read.getUserReader().getAppUser();
        const sender = appUser || user;

        const notifier = modify.getNotifier();
        await notifier.notifyUser(user, {
            room: room,
            sender: sender, 
            text: `**Resume Intelligence is Ready!** 🚀\n\nDrag and drop a PDF here to analyze it.\n(Connected to: Port 8000)`,
        });
    }
}

class SearchResumeCommand implements ISlashCommand {
    public command = 'resume-search';
    public i18nParamsExample = 'query';
    public i18nDescription = 'Find candidates using natural language';
    public providesPreview = false;

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persistence: IPersistence
    ): Promise<void> {
        const user = context.getSender();
        const room = context.getRoom();
        const appUser = await read.getUserReader().getAppUser();
        
        const query = context.getArguments().join(' ');
        if (!query) {
             // ... (Keep existing validation logic)
             return;
        }

        const notifier = modify.getNotifier();
        await notifier.notifyUser(user, {
            room: room,
            sender: appUser || user,
            text: `🔍 **Searching The Vault for:** _${query}_...`
        });

        try {
            const BACKEND_URL = 'http://host.docker.internal:8000/api/resume/search'; 
            const response = await http.post(BACKEND_URL, {
                headers: { 'Content-Type': 'application/json' },
                content: JSON.stringify({ query: query })
            });

            if (!response.content) throw new Error("No content from backend");
            const rawData = JSON.parse(response.content); 
            
            // ... (Keep existing unpacking logic) ...
            let candidates: any[] = [];
            if (Array.isArray(rawData)) candidates = rawData;
            else if (rawData.data) candidates = rawData.data;
            else if (rawData.matches) candidates = rawData.matches; // Pinecone style
            
            if (!candidates || candidates.length === 0) {
                 // ... (Keep existing "No results" logic)
                return;
            }

            // 1. Send Header
            const headerMsg = modify.getCreator().startMessage()
                .setRoom(room)
                .setText(`### 🎯 Found ${candidates.length} Candidates for: "${query}"`);
            await modify.getCreator().finish(headerMsg);

            // 2. Process Candidates
            for (const candidate of candidates.slice(0, 3)) {
                
                // --- THE SMART SUMMARY LOGIC ---
                const fullText = candidate.text || candidate.rawText || candidate.snippet || "";
                
                // Target length: ~850 chars (About 1/4th of a page)
                // We grab a chunk slightly larger to give us room to backtrack
                const limit = 850;
                let summary = "";

                if (fullText.length <= limit) {
                    summary = fullText;
                } else {
                    // Cut a chunk
                    const chunk = fullText.substring(0, limit + 50); // +50 buffer
                    
                    // Find last period to end on a sentence
                    const lastPeriod = chunk.lastIndexOf('.');
                    
                    if (lastPeriod > limit * 0.5) { 
                        // If we found a period in the second half, cut there
                        summary = chunk.substring(0, lastPeriod + 1);
                    } else {
                        // Fallback: Find last newline (for bullet points)
                        const lastNewline = chunk.lastIndexOf('\n');
                        if (lastNewline > limit * 0.5) {
                            summary = chunk.substring(0, lastNewline);
                        } else {
                            // Last resort: Cut at last space to avoid splitting a word
                            const lastSpace = chunk.lastIndexOf(' ');
                            summary = chunk.substring(0, lastSpace) + "...";
                        }
                    }
                }
                
                if (!summary) summary = "_No text available_";
                // -------------------------------

                let finalScore = Number(candidate.score);
                if (isNaN(finalScore)) finalScore = 0;
                if (finalScore <= 1 && finalScore > 0) finalScore *= 100;
                const scoreDisplay = `${Math.round(finalScore)}%`;

                const name = candidate.name || "Unknown";
                const email = candidate.email || "No Email";

                // Build Card
                let cardText = `**${name}** |  🔥 Match: \`${scoreDisplay}\`\n`;
                cardText += `📧 ${email}\n\n`;
                cardText += `> ${summary}`; 

                const msg = modify.getCreator().startMessage()
                    .setRoom(room)
                    .setText(cardText);
                
                await modify.getCreator().finish(msg);
            }

        } catch (error) {
            // ... (Keep error handling)
        }
    }
}