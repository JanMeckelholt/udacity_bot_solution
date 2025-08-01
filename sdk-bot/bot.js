const { ActivityHandler, MessageFactory } = require('botbuilder');
const { ConversationAnalysisClient, AzureKeyCredential } = require('@azure/ai-language-conversations');

class EchoBot extends ActivityHandler {
    constructor() {
        super();
        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        this.onMessage(async (context, next) => {
            const replyText = `Echo: ${ context.activity.text }`;
            await context.sendActivity(MessageFactory.text(replyText, replyText));
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            const welcomeText = 'Hello and welcome to EchoBot!';
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }
}

class QnABot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        super();
        if (!configuration) throw new Error('[QnABot]: Missing parameter. configuration is required');

        const endpoint = configuration.QnAEndpointHostName;
        const credential = new AzureKeyCredential(configuration.QnAAuthKey);

        this.qnaClient = new ConversationAnalysisClient(endpoint, credential);

        this.projectName = configuration.QnAProjectName;
        this.deploymentName = qnaOptions.deploymentName || 'production';

        this.onMessage(async (context, next) => {
            const question = context.activity.text;
            try {
                const result = await this.qnaClient.analyzeConversation({
                    kind: 'CustomQuestionAnswering',
                    analysisInput: {
                        conversationItem: {
                            text: question,
                            id: '1',
                            participantId: 'user'
                        }
                    },
                    parameters: {
                        projectName: this.projectName,
                        deploymentName: this.deploymentName
                    }
                });
                const answers = result.result && result.result.answers ? result.result.answers : [];
                if (answers && answers.length > 0 && answers[0].answer) {
                    await context.sendActivity(answers[0].answer);
                } else {
                    await context.sendActivity('I\'m not sure I found an answer to your question');
                }
            } catch (err) {
                await context.sendActivity('Error querying QnA service.');
                await context.sendActivity(`err: ${ err }`);
                console.error(err);
            }
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            const welcomeText = 'Hello and welcome to QnABot!';
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }
            await next();
        });
    }
}

module.exports.EchoBot = EchoBot;
module.exports.QnABot = QnABot;
