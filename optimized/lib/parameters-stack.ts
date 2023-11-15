    
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export class ParametersStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
   
        const dbUsernameValue = new StringParameter(this, "DBUsername", {
          parameterName: "/lambda-optimized/dbUsername",
          description: "DBUsername",
          stringValue: 'syscdk'
        });

        const dbNameValue = new StringParameter(this, "DBName", {
          parameterName: "/lambda-optimized/dbName",
          description: "dbName",
          stringValue: 'Stadiums'
        });

        const dbPortValue = new StringParameter(this, "DBPort", {
          parameterName: "/lambda-optimized/dbPort",
          description: "dbPort",
          stringValue: "5432"
        });

        const cacheEnabled = new StringParameter(this, "IsCacheEnabled", {
          parameterName: "/lambda-optimized/isCacheEnabled",
          description: "cache enabled",
          stringValue: "true"
        });
        
        const EUParameterStoreExtensionValue = new StringParameter(this, "EUParameterStoreExtensionValue", {
          parameterName: "/lambda-optimized/parameters-store/eu-west-1/arm",
          description: "ARN for ParameterStore extension in eu-west-1 for ARM architecture",
          stringValue: "arn:aws:lambda:eu-west-1:015030872274:layer:AWS-Parameters-and-Secrets-Lambda-Extension-Arm64:11"
        });

        const USParameterStoreExtensionValue = new StringParameter(this, "USParameterStoreExtensionValue", {
          parameterName: "/lambda-optimized/parameters-store/us-east-1/arm",
          description: "ARN for ParameterStore extension in us-east-1 for ARM architecture",
          stringValue: "arn:aws:lambda:us-east-1:177933569100:layer:AWS-Parameters-and-Secrets-Lambda-Extension-Arm64:11"
        });
    };
}