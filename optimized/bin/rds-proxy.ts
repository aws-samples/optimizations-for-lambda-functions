#!/usr/bin/env node
// import 'source-map-support/register';
import { App } from 'aws-cdk-lib';

import { StadiumsStack } from "../lib/stadiums-stack.ts";
import { ParametersStack } from "../lib/parameters-stack.ts";
import { PowerTuningStack } from '../lib/lambda-powertuning.ts';

const stackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT as string,
    region: process.env.CDK_DEFAULT_REGION as string,
  },
};
const app = new App();

const powertuningStack = new PowerTuningStack(app, "PowerTuningStack", {
  ...stackProps,
  description: "This stack creates PowerTuning stack for Lambda testing"
})

const parametersStack = new ParametersStack(app, "ParametersStack", {
  ...stackProps,
  description: "This stack creates the parameters needed to configure the infrastrcture of the other stacks"
})

const rdsProxyStack = new StadiumsStack (app, "StadiumsStack", {
  ...stackProps,
  description: "This stack creates a new Postgres database in a private (isolated) subnet",
});

app.synth();