import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PostgresDB } from './database/PostgresDB.ts';
import { DBParams } from './database/DBValueObject.ts';
import stadiumData from './stadium-data.json';
import { DBparameters } from './database/DBparameters.ts';
import { Stadium } from "./database/StadiumValueObject.ts";
import { logger, tracer } from "./powertools/utilities.ts";
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger';

import middy from "@middy/core";

const lambdaHandler = async function (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const parameters = new DBparameters()
    const parametersList:DBParams = await parameters.getParameters();
    logger.info('DB params retrieved', { details: { dbParams: parametersList } });
    const db = new PostgresDB();

    await db.init(parametersList);

    const stadiums:Array<Stadium> = [];
    for(const stadium of stadiumData.stadiums) {
      stadiums.push(stadium as Stadium);
    }

    const stadiumsInserted = await db.insertStadiums(stadiums);
    logger.info('stadiums inserted', { details: { result: stadiumsInserted } });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "message": "Stadium table and data successfully created." })
    };

  } catch (error) {
    console.error('Unable to connect to the database:', error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(error)
    }
  }
};

export const handler = middy(lambdaHandler)
                        .use(captureLambdaHandler(tracer))
                        .use(injectLambdaContext(logger, { clearState: true }));