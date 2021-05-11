'use strict';

const aws = require("aws-sdk");
const { get } = require("axios");

class Handler {
    constructor({ rekoSvc, translatorSvc }) {
        this.rekoSvc = rekoSvc;
        this.translatorSvc = translatorSvc;
    }

    async detectImageLabels(buffer) {
        const result = await this.rekoSvc.detectLabels({
            Image: {
                Bytes: buffer
            }
        }).promise();

        const workingItems = result.Labels
            .filter(label => label.Confidence > 80);
        
        const names = workingItems
            .map(label => label.Name)
            .join(" and ");

        return { names, workingItems };
    }

    async translateText(text) {
        const params = {
            SourceLanguageCode: "en",
            TargetLanguageCode: "pt",
            Text: text
        };
        const { TranslatedText } = await this.translatorSvc
            .translateText(params)
            .promise();

        return TranslatedText.split(" e ");
    }

    formatTextResult(texts, workingItems) {
        const finalText = [];
        for (let textIndex in texts) {
            const nameInPortuguese = texts[textIndex];
            const confidence = workingItems[textIndex].Confidence;
            finalText.push(`${confidence.toFixed(2)}% de chance de ser ${nameInPortuguese}`)
        }
        return finalText.join("\n");
    }

    async getImageBuffer(imageUrl) {
        const response = await get(imageUrl, {
            responseType: "arraybuffer",
        });
        const buffer = Buffer.from(response.data, "base64");
        return buffer;
    }

    async main(event) {
        const { imageUrl } = event.queryStringParameters;
        const buffer = await this.getImageBuffer(imageUrl)
        const { names, workingItems } = await this.detectImageLabels(buffer);
        const translatedText = await this.translateText(names);
        const finalText = this.formatTextResult(translatedText, workingItems);
        try {
            return {
                statusCode: 200,
                body: "A imagem analisada tem:\n".concat(finalText),
            }
        } catch (err) {
            console.err(`Error: ${err.stack}`);
            return {
                statusCode: 500,
                body: "Internal server error"
            }
        }
    }
}

const reko = new aws.Rekognition();
const translator = new aws.Translate();
const handler = new Handler({
    rekoSvc: reko,
    translatorSvc: translator,
});

module.exports.main = handler.main.bind(handler);
