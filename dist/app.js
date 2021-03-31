"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var path_1 = __importDefault(require("path"));
var dotenv_1 = __importDefault(require("dotenv"));
var cluster_1 = __importDefault(require("cluster"));
var express_1 = __importDefault(require("express"));
var body_parser_1 = require("body-parser");
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var client_sns_1 = require("@aws-sdk/client-sns");
dotenv_1.default.config();
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var cpuCount, i, region, dbClient_1, snsClient_1, ddbTable_1, snsTopic_1, app, port_1;
    return __generator(this, function (_a) {
        if (cluster_1.default.isMaster) {
            cpuCount = require("os").cpus().length;
            for (i = 0; i < cpuCount; i++) {
                cluster_1.default.fork();
            }
            cluster_1.default.on("exit", function (worker) {
                console.log("Worker " + worker.id + " died :(");
                cluster_1.default.fork();
            });
        }
        else {
            region = process.env.REGION || "sa-east-1";
            dbClient_1 = new client_dynamodb_1.DynamoDBClient({ region: region });
            snsClient_1 = new client_sns_1.SNSClient({ region: region });
            ddbTable_1 = process.env.STARTUP_SIGNUP_TABLE || "nodejs-tutorial";
            snsTopic_1 = process.env.NEW_SIGNUP_TOPIC || "hello-node";
            app = express_1.default();
            app.set("view engine", "ejs");
            app.set("views", path_1.default.join(__dirname, "../views"));
            app.use(body_parser_1.urlencoded({ extended: false }));
            app.use("/static", express_1.default.static(path_1.default.join(__dirname, "../static")));
            app.get("/", function (req, res) {
                res.render("index", {
                    static_path: "static",
                    theme: process.env.THEME || "flatly",
                    flask_debug: process.env.FLASK_DEBUG || "false",
                });
            });
            app.post("/signup", function (_a, res) {
                var _b = _a.body, email = _b.email, name = _b.name, previewAccess = _b.previewAccess, theme = _b.theme;
                return __awaiter(this, void 0, void 0, function () {
                    var TopicArn, Subscriptions, snsData, error_1, error_2, returnStatus;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _c.trys.push([0, 9, , 10]);
                                return [4, snsClient_1.send(new client_sns_1.CreateTopicCommand({ Name: snsTopic_1 }))];
                            case 1:
                                TopicArn = (_c.sent()).TopicArn;
                                return [4, snsClient_1.send(new client_sns_1.ListSubscriptionsByTopicCommand({ TopicArn: TopicArn }))];
                            case 2:
                                Subscriptions = (_c.sent()).Subscriptions;
                                if (!!(Subscriptions === null || Subscriptions === void 0 ? void 0 : Subscriptions.find(function (sub) { return sub.Endpoint === email; }))) return [3, 5];
                                return [4, dbClient_1.send(new client_dynamodb_1.PutItemCommand({
                                        TableName: ddbTable_1,
                                        Item: {
                                            email: { S: email },
                                            name: { S: name },
                                            preview: { S: previewAccess },
                                            theme: { S: theme },
                                        },
                                    }))];
                            case 3:
                                _c.sent();
                                return [4, snsClient_1.send(new client_sns_1.SubscribeCommand({
                                        Protocol: "email",
                                        TopicArn: TopicArn,
                                        Endpoint: email,
                                    }))];
                            case 4:
                                _c.sent();
                                res.status(201).end();
                                _c.label = 5;
                            case 5:
                                _c.trys.push([5, 7, , 8]);
                                return [4, snsClient_1.send(new client_sns_1.PublishCommand({
                                        Message: ("Name: " + name + "\n                          Email: " + email + "\n                          PreviewAccess: " + previewAccess + "\n                          Theme: " + theme).replace("\t", ""),
                                        Subject: "New user sign up!!!",
                                        TopicArn: TopicArn,
                                    }))];
                            case 6:
                                snsData = _c.sent();
                                console.log("Message sent to the topic");
                                console.log("MessageID is " + snsData.MessageId);
                                res.status(201).end();
                                return [3, 8];
                            case 7:
                                error_1 = _c.sent();
                                res.status(500).end();
                                console.log("SNS Error: " + error_1);
                                return [3, 8];
                            case 8: return [3, 10];
                            case 9:
                                error_2 = _c.sent();
                                returnStatus = 500;
                                if (error_2.code === "ConditionalCheckFailedException") {
                                    returnStatus = 409;
                                }
                                res.status(returnStatus).end();
                                console.log("DDB Error: " + error_2);
                                return [3, 10];
                            case 10: return [2];
                        }
                    });
                });
            });
            port_1 = process.env.PORT || 3000;
            app.listen(port_1, function () {
                console.log("Server running at http://127.0.0.1:" + port_1 + "/");
            });
        }
        return [2];
    });
}); })();
//# sourceMappingURL=app.js.map