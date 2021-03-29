// Include the cluster module
const cluster = require('cluster');

// Code to run if we're in the master process
if (cluster.isMaster) {

    // Count the machine's CPUs
    const cpuCount = require('os').cpus().length;

    // Create a worker for each CPU
    for (let i = 0; i < cpuCount; i++) {
        cluster.fork();
    }

    // Listen for terminating workers
    cluster.on('exit', function(worker) {

        // Replace the terminated workers
        console.log('Worker ' + worker.id + ' died :(');
        cluster.fork();

    });

    // Code to run if we're in a worker process
} else {
    const AWS = require('aws-sdk');
    const express = require('express');
    const bodyParser = require('body-parser');
    const path = require('path')

    AWS.config.region = process.env.REGION

    const sns = new AWS.SNS();
    const ddb = new AWS.DynamoDB();

    const ddbTable = process.env.STARTUP_SIGNUP_TABLE;
    const snsTopic = process.env.NEW_SIGNUP_TOPIC;
    const app = express();

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use('/static', express.static(path.join(__dirname, 'static')))

    app.get('/', function(req, res) {
        res.render('index', {
            static_path: 'static',
            theme: process.env.THEME || 'flatly',
            flask_debug: process.env.FLASK_DEBUG || 'false'
        });
    });

    app.post('/signup', function({ body: { email, name, previewAccess, theme } }, res) {
        const item = {
            'email': { 'S': email },
            'name': { 'S': name },
            'preview': { 'S': previewAccess },
            'theme': { 'S': theme }
        };

        ddb.putItem({
            'TableName': ddbTable,
            'Item': item,
            'Expected': { email: { Exists: false } }
        }, function(err, data) {
            if (err) {
                let returnStatus = 500;

                if (err.code === 'ConditionalCheckFailedException') {
                    returnStatus = 409;
                }

                res.status(returnStatus).end();
                console.log('DDB Error: ' + err);
            } else {
                sns.publish({
                    'Message': `Name: ${name}
                        Email: ${email}
                        PreviewAccess: ${previewAccess}
                        Theme: ${theme}`,
                    'Subject': 'New user sign up!!!',
                    'TopicArn': snsTopic
                }, function(err, data) {
                    if (err) {
                        res.status(500).end();
                        console.log('SNS Error: ' + err);
                    } else {
                        res.status(201).end();
                    }
                });
            }
        });
    });

    const port = process.env.PORT || 3000;

    const server = app.listen(port, function() {
        console.log('Server running at http://127.0.0.1:' + port + '/');
    });
}