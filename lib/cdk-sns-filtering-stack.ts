import {CfnOutput, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {SubscriptionFilter, Topic} from "aws-cdk-lib/aws-sns";
import {Queue} from "aws-cdk-lib/aws-sqs";
import {SqsSubscription} from "aws-cdk-lib/aws-sns-subscriptions";

export class CdkSnsFilteringStack extends Stack {
    private readonly appName: string;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        this.appName = this.node.tryGetContext('appName')

        //Creating the All Customers, Gold Customers and Platinum Customers queues
        const customers = this.createQueue('AllCustomers');
        const goldCustomers = this.createQueue('GoldCustomers');
        const platinumCustomers = this.createQueue('PlatinumCustomers');

        //Creating the SNS topic for customer requests
        const snsTopic = this.createCustomerSNSTopic();

        //AllCustomers queue subscribes to SNS topic
        snsTopic.addSubscription(new SqsSubscription(customers));

        //GoldCustomers queue subscribes to SNS topic
        //GoldCustomers receives platinum customer's requests
        snsTopic.addSubscription(new SqsSubscription(goldCustomers, {
            filterPolicy: {
                type: SubscriptionFilter.stringFilter({
                    allowlist: ['Gold']
                }),
            }
        }));

        //PlatinumCustomers queue subscribes to SNS topic
        //PlatinumCustomers receives platinum customer's requests
        snsTopic.addSubscription(new SqsSubscription(platinumCustomers, {
            filterPolicy: {
                type: SubscriptionFilter.stringFilter({
                    allowlist: ['Platinum']
                }),
            }
        }));

        new CfnOutput(this, `${this.appName}-CustomersTopic-Arn`, {
            value: snsTopic.topicArn
        });

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
}
