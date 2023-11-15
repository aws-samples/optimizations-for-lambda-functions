#!/usr/bin/env node
import { App } from 'aws-cdk-lib';

import { StadiumsStack } from "../lib/stadiums-stack.ts";
import { ParametersStack } from "../lib/parameters-stack.ts";

const stackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT as string,
    region: "eu-west-2",
  },
};
const app = new App();

const parametersStack = new ParametersStack(app, "ParametersStackUnoptimized", {
  ...stackProps,
  description: "This stack creates the parameters needed to configure the infrastrcture of the other stacks"
})

const rdsProxyStack = new StadiumsStack (app, "StadiumsStackUnoptimized", {
  ...stackProps,
  description: "This stack creates a new Postgres database in a private (isolated) subnet",
});
