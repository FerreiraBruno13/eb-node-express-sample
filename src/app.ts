// Include the cluster module
import path from "path";
import dotenv from "dotenv";
import cluster from "cluster";
import express from "express";
import { urlencoded } from "body-parser";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import {
  SNSClient,
  PublishCommand,
  CreateTopicCommand,
  SubscribeCommand,
  ListSubscriptionsByTopicCommand,
} from "@aws-sdk/client-sns";

dotenv.config();

(async () => {
  // Code to run if we're in the master process
  if (cluster.isMaster) {
    // Count the machine's CPUs
    const cpuCount = require("os").cpus().length;

    // Create a worker for each CPU
    for (let i = 0; i < cpuCount; i++) {
      cluster.fork();
    }

    // Listen for terminating workers
    cluster.on("exit", function (worker) {
      // Replace the terminated workers
      console.log("Worker " + worker.id + " died :(");
      cluster.fork();
    });

    // Code to run if we're in a worker process
  } else {
    const region = process.env.REGION || "sa-east-1";

    const dbClient = new DynamoDBClient({ region });
    const snsClient = new SNSClient({ region });

    const ddbTable = process.env.STARTUP_SIGNUP_TABLE || "nodejs-tutorial";
    const snsTopic = process.env.NEW_SIGNUP_TOPIC || "hello-node";
    const app = express();

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "../views"));
    app.use(urlencoded({ extended: false }));
    app.use("/static", express.static(path.join(__dirname, "../static")));

    app.get("/", function (req, res) {
      res.render("index", {
        static_path: "static",
        theme: process.env.THEME || "flatly",
        flask_debug: process.env.FLASK_DEBUG || "false",
      });
    });

    app.post(
      "/signup",
      async function ({ body: { email, name, previewAccess, theme } }, res) {
        try {
          const { TopicArn } = await snsClient.send(
            new CreateTopicCommand({ Name: snsTopic })
          );

          const { Subscriptions } = await snsClient.send(
            new ListSubscriptionsByTopicCommand({ TopicArn })
          );

          if (!Subscriptions?.find((sub) => sub.Endpoint === email)) {
            await dbClient.send(
              new PutItemCommand({
                TableName: ddbTable,
                Item: {
                  email: { S: email },
                  name: { S: name },
                  preview: { S: previewAccess },
                  theme: { S: theme },
                },
              })
            );

            await snsClient.send(
              new SubscribeCommand({
                Protocol: "email",
                TopicArn,
                Endpoint: email,
              })
            );

            res.status(201).end();
          }

          try {
            const snsData = await snsClient.send(
              new PublishCommand({
                Message: `Name: ${name}`
                        + `\nEmail: ${email}`
                        + `\nPreviewAccess: ${previewAccess}`
                        + `\nTheme: ${theme}`,
                Subject: "New user sign up!!!",
                TopicArn,
              })
            );

            console.log("Message sent to the topic");
            console.log(`MessageID is ${snsData.MessageId}`);

            res.status(201).end();
          } catch (error) {
            res.status(500).end();
            console.log(`SNS Error: ${error}`);
          }
        } catch (error) {
          let returnStatus = 500;

          if (error.code === "ConditionalCheckFailedException") {
            returnStatus = 409;
          }

          res.status(returnStatus).end();
          console.log(`DDB Error: ${error}`);
        }
      }
    );

    const port = process.env.PORT || 3000;

    app.listen(port, function () {
      console.log(`Server running at http://127.0.0.1:${port}/`);
    });
  }
})();
