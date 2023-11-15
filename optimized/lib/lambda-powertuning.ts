    
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { CfnApplication } from 'aws-cdk-lib/aws-sam';
import { Construct } from 'constructs';


export class PowerTuningStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        let powerValues = '128,256,512,1024,1536,3008';
        let lambdaResource = "*";

        new CfnApplication(this, 'powerTuner', {
            location: {
              applicationId: 'arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning',
              semanticVersion: '4.2.0'
            },
            parameters: {
              "lambdaResource": lambdaResource,
              "PowerValues": powerValues
            }
          })
    
    };
}