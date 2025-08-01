const { ActivityHandler, MessageFactory } = require('botbuilder');
const { ConversationAnalysisClient, AzureKeyCredential } = require('@azure/ai-language-conversations');
const https = require('https');

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
                const answer = await queryQnA(configuration, qnaOptions, question);
                await context.sendActivity(answer);
            } catch (err) {
                await context.sendActivity(`Error querying QnA service. with question: ${ question }`);
                await context.sendActivity(`err: ${ err } `);
                await context.sendActivity(`QnAEndpointHostName: ${ configuration.QnAEndpointHostName } \n QnAAuthKey: ${ configuration.QnAAuthKey } \n QnAProjectName: ${ configuration.QnAProjectName } \n`);
                await context.sendActivity(`qnaClient: ${ this.qnaClient } \n projectName: ${ this.projectName } \n deploymentName: ${ this.deploymentName } \n`);
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

async function queryQnA(configuration, qnaOptions, question) {
    return new Promise((resolve, reject) => {
        try {
            const path = `/language/:query-knowledgebases?projectName=${ configuration.QnAProjectName }&api-version=2021-10-01&deploymentName=${ qnaOptions.deploymentName || 'production' }`;
            const options = {
                hostname: configuration.QnAEndpointHostName.replace(/^https:\/\//, ''), // Remove https:// from endpoint
                path: path,
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': configuration.QnAAuthKey,
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        console.log('Full result:', JSON.stringify(result, null, 2)); // Log the full result

                        if (result && result.answers && result.answers.length > 0) {
                            console.log('Answer:', result.answers[0].answer);
                            resolve(result.answers[0].answer);
                        } else {
                            console.log('No answer found.');
                            resolve('No answer found.');
                        }
                    } catch (parseError) {
                        console.error('Error parsing JSON:', parseError);
                        reject(`Error parsing JSON: ${ parseError.message }`);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Error querying QnA service:', error);
                reject(`Error querying QnA service: ${ error.message }`);
            });

            const postData = JSON.stringify({
                question: question,
                top: 3,
                includeUnstructuredSources: true
            });

            req.write(postData);
            req.end();
        } catch (error) {
            console.error('Error setting up request:', error);
            reject(`Error setting up request: ${ error.message }`);
        }
    });
}

module.exports.EchoBot = EchoBot;
module.exports.QnABot = QnABot;
