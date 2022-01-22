import {CfnOutput, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {SubscriptionFilter, Topic} from "aws-cdk-lib/aws-sns";
import {Queue} from "aws-cdk-lib/aws-sqs";
import {SqsSubscription} from "aws-cdk-lib/aws-sns-subscriptions";
import {Code, Function, Runtime} from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import {SqsEventSource} from "aws-cdk-lib/aws-lambda-event-sources";
import {Effect, Policy, PolicyStatement} from "aws-cdk-lib/aws-iam";

export class CdkSnsFilteringStack extends Stack {
    private readonly appName: string;
    private readonly allCustomersQueue: Queue;
    private readonly goldCustomersQueue: Queue;
    private readonly platinumCustomersQueue: Queue;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        this.appName = this.node.tryGetContext('appName')

        //Creating the All Customers, Gold Customers and Platinum Customers queues
        this.allCustomersQueue = this.createQueue('AllCustomers');
        this.goldCustomersQueue = this.createQueue('GoldCustomers');
        this.platinumCustomersQueue = this.createQueue('PlatinumCustomers');

        //Creating the SNS topic for customer requests
        const snsTopic = this.createCustomerSNSTopic();

        //AllCustomers queue subscribes to SNS topic
        snsTopic.addSubscription(new SqsSubscription(this.allCustomersQueue));

        //GoldCustomers queue subscribes to SNS topic
        //GoldCustomers receives platinum customer's requests
        snsTopic.addSubscription(new SqsSubscription(this.goldCustomersQueue, {
            filterPolicy: {
                type: SubscriptionFilter.stringFilter({
                    allowlist: ['Gold']
                }),
            }
        }));

        //PlatinumCustomers queue subscribes to SNS topic
        //PlatinumCustomers receives platinum customer's requests
        snsTopic.addSubscription(new SqsSubscription(this.platinumCustomersQueue, {
            filterPolicy: {
                type: SubscriptionFilter.stringFilter({
                    allowlist: ['Platinum']
                }),
            }
        }));

        new CfnOutput(this, `${this.appName}-CustomersTopic-Arn`, {
            value: snsTopic.topicArn
        });

        this.createAllCustomersLambdaFunction();
        this.createGoldCustomersLambdaFunction();
        this.createPlatinumCustomersLambdaFunction();
    }

    private createCustomerSNSTopic = (): Topic => {
        return new Topic(this, `${this.appName}-CustomerRequestTopic`, {
            topicName: 'CustomerRequests',
            displayName: 'Customer Requests',
        });
    }

    private createQueue = (queueName: string): Queue => {
        return new Queue(this, `${this.appName}-${queueName}-Queue`)
    }

    private createAllCustomersLambdaFunction = () => {
        const allCustomersLambdaFunction = new Function(this, `${this.appName}-All-Customers-Lambda`, {
            code: Code.fromAsset(path.join(__dirname, '../lambda/all-customers')),
            handler: "all-customers.handler",
            runtime: Runtime.NODEJS_14_X
        });

        allCustomersLambdaFunction.addEventSource(new SqsEventSource(this.allCustomersQueue, {
            batchSize: 10
        }));

        allCustomersLambdaFunction.role?.attachInlinePolicy(new Policy(this, `${this.appName}-SQS-Permission-For-AllCustomers-Queue`,{
            statements: [this.getLambdaSqsPermissionPolicy(this.allCustomersQueue.queueArn)]
        }));

    }

    private createGoldCustomersLambdaFunction = () => {
        const goldCustomersLambdaFunction = new Function(this, `${this.appName}-Gold-Customers-Lambda`, {
            code: Code.fromAsset(path.join(__dirname, '../lambda/gold-customers')),
            handler: "gold-customers.handler",
            runtime: Runtime.NODEJS_14_X
        });

        goldCustomersLambdaFunction.addEventSource(new SqsEventSource(this.goldCustomersQueue, {
            batchSize: 10
        }));

        goldCustomersLambdaFunction.role?.attachInlinePolicy(new Policy(this, `${this.appName}-SQS-Permission-For-GoldCustomers-Queue`,{
            statements: [this.getLambdaSqsPermissionPolicy(this.goldCustomersQueue.queueArn)]
        }));
    }

    private createPlatinumCustomersLambdaFunction = () => {
        const platinumCustomerLambdaFunction = new Function(this, `${this.appName}-Platinum-Customers-Lambda`, {
            code: Code.fromAsset(path.join(__dirname, '../lambda/platinum-customers')),
            handler: "platinum-customers.handler",
            runtime: Runtime.NODEJS_14_X
        });

        platinumCustomerLambdaFunction.addEventSource(new SqsEventSource(this.platinumCustomersQueue, {
            batchSize: 10
        }));

        platinumCustomerLambdaFunction.role?.attachInlinePolicy(new Policy(this, `${this.appName}-SQS-Permission-For-PlatinumCustomers-Queue`,{
            statements: [this.getLambdaSqsPermissionPolicy(this.platinumCustomersQueue.queueArn)]
        }));
    }

    private getLambdaSqsPermissionPolicy = (queueArn: string): PolicyStatement => {
        return new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "sqs:SendMessage",
                "sqs:DeleteMessage",
                "sqs:ChangeMessageVisibility",
                "sqs:ReceiveMessage",
                "sqs:TagQueue",
                "sqs:UntagQueue",
                "sqs:PurgeQueue"
            ],
            resources: [queueArn]
        });
    }
}
