import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { DBParams } from './database/DBValueObject.ts';
import { DBparameters } from './database/DBparametersSDK.ts';
import { Database } from './database/sequelize.ts';
import { logger, tracer, metrics } from "./powertools/utilities.js";
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger';
import { logMetrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import middy from "@middy/core";


const lambdaHandler = async function (): Promise<APIGatewayProxyResultV2> {
  
  let responseStruct, db;
  
  const segment = tracer.getSegment()!;
  tracer.annotateColdStart();
  
  try {
    const SSMSubSegment = segment.addNewSubsegment(`### get params from SSM`);
    tracer.setSegment(SSMSubSegment);
    const parameters = new DBparameters()
    const parametersList:DBParams = await parameters.getParameters();
    SSMSubSegment.close();

    db = new Database();
    await db.init(parametersList); 

    const querySubSegment = segment.addNewSubsegment(`### get all stadiums`);
    tracer.setSegment(querySubSegment);
    const stadiums = await db.stadiums.findAll();
    querySubSegment.close();
    logger.info('total stadiums retrieved', { details: { total_stadiums: stadiums.length } });
    metrics.addMetric('all stadiums requests', MetricUnits.Count, 1);

    responseStruct = {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stadiums)
    };

  } catch (error) {

    logger.error('Unexpected error occurred while trying to retrieve stadiums', error as Error);
    const rootTraceId = tracer.getRootXrayTraceId();
    responseStruct = {
      statusCode: 500,
      headers: { _X_AMZN_TRACE_ID: rootTraceId || "" },
      body: JSON.stringify(error)
    };

  }

  await db?.closeConnection();

  tracer.setSegment(segment);
  return responseStruct
};

export const handler = middy(lambdaHandler)
                        .use(captureLambdaHandler(tracer))
                        .use(logMetrics(metrics, { captureColdStartMetric: true, throwOnEmptyMetrics: true }))
                        .use(injectLambdaContext(logger, { clearState: true }));