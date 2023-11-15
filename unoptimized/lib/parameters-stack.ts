    
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

    };
}