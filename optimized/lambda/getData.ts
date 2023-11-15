import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { PostgresDB } from './database/PostgresDB.ts';
import { DBParams } from './database/DBValueObject.ts';
import { DBparameters } from './database/DBparameters.ts';
import { Cache } from './database/Cache.ts';
import { logger, tracer, metrics } from "./powertools/utilities.ts";
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger';
import { logMetrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import middy from "@middy/core";

let parametersList:DBParams;
const cache = new Cache();
const db = new PostgresDB();

const lambdaHandler = async function (): Promise<APIGatewayProxyResultV2> {
  
  let responseStruct;
  let stadiums;

  const segment = tracer.getSegment()!;
  tracer.annotateColdStart();

  try {
    if(!parametersList){
      const parameters = new DBparameters()
      parametersList = await parameters.getParameters();
    }

    const isCacheEnabled = parametersList.isCacheEnabled as Boolean;
    
    if(isCacheEnabled){

      logger.info('cache enable', { details: { value: isCacheEnabled } })
      await cache.init(parametersList.cacheEndpoint, parametersList.cachePort);
      
      stadiums = await cache.getData("stadiums");
    }

    if (!stadiums) {
      
      await db.init(parametersList);
      
      stadiums = await db.getAllStadiums();

      if(isCacheEnabled){
        cache?.setData("stadiums", stadiums);
        logger.info('cache populated with Stadiums', { details: { value: stadiums.length } });
      }

      metrics.addMetric('Redis cache not hit', MetricUnits.Count, 1);
    }

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

  tracer.setSegment(segment);
  return responseStruct
};

export const handler = middy(lambdaHandler)
                        .use(captureLambdaHandler(tracer))
                        .use(logMetrics(metrics, { captureColdStartMetric: true, throwOnEmptyMetrics: true }))
                        .use(injectLambdaContext(logger, { clearState: true }));
